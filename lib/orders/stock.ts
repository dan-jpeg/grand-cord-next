import type { Prisma, OrderItem } from '@prisma/client'
import type { AdminSessionUser } from '@/lib/require-admin'

/** Why an order moved stock. Stored on the audit row. */
export type StockReason = 'ORDER_SHIPPED' | 'ORDER_CANCELLED'

export type StockMoveContext = {
    orderId: string
    orderNumber: string
    actor: AdminSessionUser
}

export type StockMoveResult = {
    /** false when no matching size row exists at all. */
    applied: boolean
    /**
     * How many units the order expected to move but `committed` did not hold.
     * Non-zero means the size row had already drifted from its orders.
     */
    shortfall: number
}

/**
 * Applies one order item's stock movement and records it, inside the caller's
 * transaction.
 *
 * Shipping takes goods off the shelf: `committed` and `total` both fall, and
 * the audit row tracks `total`. Cancelling before shipment puts them back up
 * for sale: `committed` falls, `available` rises, and the row tracks
 * `available`. In both cases `field` names which counter the before/after
 * numbers refer to, since they are not the same one.
 *
 * Only what `committed` actually holds is moved. A row that has drifted — fewer
 * units committed than the order claims — would otherwise be driven to negative
 * `committed`, and would break the `total = available + committed` invariant.
 * The unmovable remainder comes back as `shortfall` for the caller to report.
 *
 * `applied` is false when no matching size row exists at all — a size renamed
 * or deleted after the order was placed. Callers decide whether that is fatal.
 */
export async function applyOrderStockMove(
    tx: Prisma.TransactionClient,
    item: OrderItem,
    reason: StockReason,
    ctx: StockMoveContext,
): Promise<StockMoveResult> {
    const size = await tx.productSize.findFirst({
        where: { productId: item.productId, size: item.size },
    })
    if (!size) return { applied: false, shortfall: item.quantity }

    const movable = Math.min(item.quantity, Math.max(0, size.committed))
    const shortfall = item.quantity - movable

    if (movable === 0) {
        return { applied: true, shortfall }
    }

    const field = reason === 'ORDER_SHIPPED' ? 'total' : 'available'
    const before = field === 'total' ? size.total : size.available
    const delta = reason === 'ORDER_SHIPPED' ? -movable : movable
    const after = before + delta

    await tx.productSize.update({
        where: { id: size.id },
        data:
            reason === 'ORDER_SHIPPED'
                ? {
                      committed: { decrement: movable },
                      total: { decrement: movable },
                  }
                : {
                      committed: { decrement: movable },
                      available: { increment: movable },
                  },
    })

    await tx.inventoryChangeLog.create({
        data: {
            productId: item.productId,
            productSizeId: size.id,
            productName: item.productName,
            sizeLabel: item.size,
            delta,
            before,
            after,
            field,
            reason,
            orderId: ctx.orderId,
            orderNumber: ctx.orderNumber,
            adminUserId: ctx.actor.id,
            adminEmail: ctx.actor.email ?? '',
            adminName: ctx.actor.name ?? null,
        },
    })

    return { applied: true, shortfall }
}
