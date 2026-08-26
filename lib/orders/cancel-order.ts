import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'
import { applyOrderStockMove, type StockActor } from '@/lib/orders/stock'
import { getRefundableCents, hasUsablePaymentIntent } from '@/lib/orders/refunds'
import { sendOrderCancelledEmail } from '@/lib/email/order-emails'

/**
 * What cancelling should do to the customer's money. There is no implicit
 * default — every caller states its intent, because the two behaviors used to
 * diverge silently between the order screen (never refunded) and the pick flow
 * (always refunded in full).
 */
export type RefundChoice = 'FULL_REFUND' | 'NO_REFUND'

export type CancelResult = {
    /** false when the order was already cancelled and nothing was done. */
    cancelled: boolean
    /** Cents actually returned to the customer on this call. */
    refundedCents: number
    /** Set when a refund was asked for but could not be issued. */
    refundSkippedReason?: string
    /** Items whose stock could not be returned, by `productName (size)`. */
    unrestoredItems: string[]
}

/**
 * The one place an order gets cancelled.
 *
 * Money moves first: a refund that fails must not leave the order marked
 * cancelled with the customer still charged and no record of why. Inventory is
 * only restored for orders that never shipped — once goods are out the door the
 * stock is genuinely gone.
 *
 * The status write and every stock movement share one transaction, and each
 * movement writes an InventoryChangeLog row attributed to the acting admin.
 */
export async function cancelOrder(
    orderId: string,
    refundChoice: RefundChoice,
    actor: StockActor,
): Promise<CancelResult> {
    const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: { items: true },
    })
    if (!order) throw new Error('Order not found')

    // Cancelling twice must not refund twice or restore stock twice.
    if (order.status === 'CANCELLED') {
        return { cancelled: false, refundedCents: 0, unrestoredItems: [] }
    }

    const previousStatus = order.status

    let refundedCents = 0
    let refundSkippedReason: string | undefined

    if (refundChoice === 'FULL_REFUND') {
        // Read before the guard narrows it away — the guard's whole job is to
        // reject this value, so afterwards it is no longer inspectable.
        const neverCompletedCheckout = order.stripePaymentIntentId?.startsWith('cs_') ?? false

        if (!hasUsablePaymentIntent(order.stripePaymentIntentId)) {
            refundSkippedReason = neverCompletedCheckout
                ? 'Checkout was never completed, so there is no payment to refund.'
                : 'No Stripe payment is attached to this order.'
        } else {
            const refundable = await getRefundableCents(order.stripePaymentIntentId)
            if (refundable <= 0) {
                refundSkippedReason = 'This payment has already been fully refunded.'
            } else {
                // Deliberately before the status write — see the note above.
                await stripe.refunds.create({
                    payment_intent: order.stripePaymentIntentId,
                    amount: refundable,
                })
                refundedCents = refundable
            }
        }
    }

    // Status and stock move together — a partial failure here would leave the
    // order cancelled with only some of its inventory returned.
    const unrestoredItems: string[] = []
    await prisma.$transaction(async (tx) => {
        await tx.order.update({
            where: { id: orderId },
            data: { status: 'CANCELLED' },
        })

        // Stock only comes back if it never left. A cancelled-after-shipping
        // order has already had both `committed` and `total` decremented.
        if (previousStatus === 'PENDING' || previousStatus === 'PAID') {
            for (const item of order.items) {
                const { applied, shortfall } = await applyOrderStockMove(
                    tx,
                    item,
                    'ORDER_CANCELLED',
                    { orderId, orderNumber: order.orderNumber, actor },
                )
                // Reported rather than thrown: the refund has already gone out,
                // so rolling the cancellation back would strand the customer
                // refunded but still holding an open order.
                if (!applied) {
                    unrestoredItems.push(
                        `${item.productName} (${item.size}): none of the ${item.quantity} could be` +
                            ` returned — that size no longer exists on the product.`,
                    )
                } else if (shortfall > 0) {
                    unrestoredItems.push(
                        `${item.productName} (${item.size}): returned ${item.quantity - shortfall} of` +
                            ` ${item.quantity}. The other ${shortfall} was never reserved against this` +
                            ` order, so there was nothing to return — the stock count had already` +
                            ` drifted. Worth checking the product.`,
                    )
                }
            }
        }
    })

    // Only orders the customer actually paid for. Cancelling out of PENDING is
    // an expired or abandoned checkout — the Stripe webhook's own route into
    // this function — and mailing "your order has been cancelled" to someone
    // who never completed an order is confusing rather than helpful.
    //
    // Outside the transaction and last, like the other order emails, and
    // `sendOrderCancelledEmail` never throws: the refund has already gone out
    // by this point, so nothing here may undo a cancellation that is finished.
    if (previousStatus !== 'PENDING') {
        await sendOrderCancelledEmail(orderId, { refundedCents })
    }

    return { cancelled: true, refundedCents, refundSkippedReason, unrestoredItems }
}
