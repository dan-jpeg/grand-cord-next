import type { OrderStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { applyOrderStockMove, type StockActor } from '@/lib/orders/stock'

/**
 * Every status except CANCELLED, which carries a refund decision and goes
 * through `cancelOrder` instead.
 */
export type LiveOrderStatus = Exclude<OrderStatus, 'CANCELLED'>

/**
 * Which moves are legal from each status.
 *
 * This used to be two hardcoded `if` pairs inside `updateOrderStatus`, which
 * meant every transition nobody had thought about was silently permitted — and
 * permitted without the stock move that should accompany it. Stating the whole
 * table makes the gaps visible.
 *
 * CANCELLED is terminal here: reopening a cancelled order means deciding what
 * happens to a refund that may already have gone out, and that belongs with the
 * refund flow, not with a status dropdown.
 */
const ALLOWED_TRANSITIONS: Record<OrderStatus, LiveOrderStatus[]> = {
    PENDING: ['PAID', 'SHIPPED'],
    PAID: ['PENDING', 'SHIPPED'],
    SHIPPED: ['PENDING', 'PAID'],
    CANCELLED: [],
}

export type TransitionResult = {
    /** false when the order was already in the target status. */
    changed: boolean
    /** Non-fatal problems worth showing the admin. */
    warnings: string[]
}

export type TrackingDetails = {
    trackingNumber?: string
    trackingUrl?: string
}

/**
 * The one place an order's status changes, cancellation aside.
 *
 * Before this existed, four call sites wrote `Order.status` directly and only
 * one of them moved stock. The pick flow — the route most orders actually take
 * — shipped goods with a bare `order.update`, so `committed` never came down
 * and the audit log never recorded anything. Reverting such an order then hit
 * the un-ship branch, which increments both counters, and inventory that had
 * never been decremented was created out of nothing.
 *
 * Status and stock move in one transaction, so a partial failure cannot leave
 * an order shipped with only some of its inventory drawn down.
 */
export async function transitionOrderStatus(
    orderId: string,
    status: LiveOrderStatus,
    actor: StockActor,
    tracking?: TrackingDetails,
): Promise<TransitionResult> {
    // Server actions are reachable as plain POST endpoints, so the type is not
    // a guarantee about what arrives here.
    if ((status as OrderStatus) === 'CANCELLED') {
        throw new Error('Use cancelOrderAction to cancel an order.')
    }

    const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: { items: true },
    })
    if (!order) throw new Error('Order not found')

    const previousStatus = order.status
    const warnings: string[] = []

    // Tracking is history: it survives a revert and is only replaced when new
    // details are supplied. Clearing it used to destroy the record of what was
    // sent.
    const trackingData = {
        ...(tracking?.trackingNumber ? { trackingNumber: tracking.trackingNumber } : {}),
        ...(tracking?.trackingUrl ? { trackingUrl: tracking.trackingUrl } : {}),
    }

    // Re-marking an order with the status it already has is how tracking
    // details get attached after the fact. Allowed, but it must not move stock
    // a second time.
    if (previousStatus === status) {
        if (Object.keys(trackingData).length > 0) {
            await prisma.order.update({ where: { id: orderId }, data: trackingData })
        }
        return { changed: false, warnings }
    }

    if (!ALLOWED_TRANSITIONS[previousStatus].includes(status)) {
        throw new Error(
            previousStatus === 'CANCELLED'
                ? 'This order is cancelled. Reopening it has to be done deliberately, ' +
                  'because it may already have been refunded.'
                : `An order cannot go from ${previousStatus} to ${status}.`,
        )
    }

    const shipping = status === 'SHIPPED'
    const unShipping = previousStatus === 'SHIPPED'

    // Which lines actually had stock taken off the shelf, so un-shipping only
    // puts back what genuinely left. An order that reached SHIPPED without a
    // decrement — every order shipped from the pick flow before this change —
    // has no ORDER_SHIPPED row, and restoring it would invent inventory.
    let netShippedByLine = new Map<string, number>()
    if (unShipping) {
        const logs = await prisma.inventoryChangeLog.findMany({
            where: { orderId, reason: { in: ['ORDER_SHIPPED', 'ORDER_UNSHIPPED'] } },
            select: { productId: true, sizeLabel: true, reason: true },
        })
        netShippedByLine = logs.reduce((acc, log) => {
            const key = `${log.productId}-${log.sizeLabel}`
            return acc.set(key, (acc.get(key) ?? 0) + (log.reason === 'ORDER_SHIPPED' ? 1 : -1))
        }, new Map<string, number>())
    }

    await prisma.$transaction(async (tx) => {
        await tx.order.update({
            where: { id: orderId },
            data: { status, ...trackingData },
        })

        if (unShipping) {
            for (const item of order.items) {
                const key = `${item.productId}-${item.size}`
                if ((netShippedByLine.get(key) ?? 0) <= 0) {
                    warnings.push(
                        `${item.productName} (${item.size}): nothing was returned to stock. This ` +
                            `order was marked shipped without its inventory ever being drawn down, ` +
                            `so there is nothing to put back. Check the product's counts.`,
                    )
                    continue
                }
                await applyOrderStockMove(tx, item, 'ORDER_UNSHIPPED', {
                    orderId,
                    orderNumber: order.orderNumber,
                    actor,
                })
            }
        }

        if (shipping) {
            for (const item of order.items) {
                const { applied, shortfall } = await applyOrderStockMove(
                    tx,
                    item,
                    'ORDER_SHIPPED',
                    { orderId, orderNumber: order.orderNumber, actor },
                )
                // Nothing has been paid out on this path, so refusing the whole
                // transition is safe and beats silently shipping against
                // inventory that no longer lines up.
                if (!applied) {
                    throw new Error(
                        `No stock row for ${item.productName} (${item.size}). ` +
                            `The size may have been renamed or removed since the order was placed. ` +
                            `Fix the product's sizes, then mark it shipped again.`,
                    )
                }
                if (shortfall > 0) {
                    throw new Error(
                        `${item.productName} (${item.size}) has only ` +
                            `${item.quantity - shortfall} of ${item.quantity} units committed. ` +
                            `The stock count has drifted from this order — correct it on the ` +
                            `product, then mark it shipped again.`,
                    )
                }
            }
        }
    })

    return { changed: true, warnings }
}
