import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'

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

function hasUsablePaymentIntent(id: string | null | undefined): id is string {
    return !!id && id !== 'pending'
}

/**
 * How much of the payment can still be handed back, in cents. Reads Stripe
 * rather than the order total so that partial refunds already issued from the
 * pick flow are accounted for.
 */
export async function getRefundableCents(paymentIntentId: string): Promise<number> {
    const intent = await stripe.paymentIntents.retrieve(paymentIntentId, {
        expand: ['latest_charge'],
    })
    const charge =
        intent.latest_charge && typeof intent.latest_charge !== 'string'
            ? intent.latest_charge
            : null
    if (!charge) return 0
    return Math.max(0, charge.amount_captured - charge.amount_refunded)
}

/**
 * The one place an order gets cancelled.
 *
 * Money moves first: a refund that fails must not leave the order marked
 * cancelled with the customer still charged and no record of why. Inventory is
 * only restored for orders that never shipped — once goods are out the door the
 * stock is genuinely gone.
 *
 * Not yet transactional; that is phase 3, along with the audit rows.
 */
export async function cancelOrder(
    orderId: string,
    refundChoice: RefundChoice,
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
        if (!hasUsablePaymentIntent(order.stripePaymentIntentId)) {
            refundSkippedReason = 'No Stripe payment is attached to this order.'
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

    await prisma.order.update({
        where: { id: orderId },
        data: { status: 'CANCELLED' },
    })

    // Stock only comes back if it never left. A cancelled-after-shipping order
    // has already had both `committed` and `total` decremented.
    const unrestoredItems: string[] = []
    if (previousStatus === 'PENDING' || previousStatus === 'PAID') {
        for (const item of order.items) {
            const { count } = await prisma.productSize.updateMany({
                where: { productId: item.productId, size: item.size },
                data: {
                    committed: { decrement: item.quantity },
                    available: { increment: item.quantity },
                },
            })
            // A renamed or deleted size matches nothing and would otherwise
            // swallow the restore silently.
            if (count === 0) {
                unrestoredItems.push(`${item.productName} (${item.size})`)
            }
        }
    }

    return { cancelled: true, refundedCents, refundSkippedReason, unrestoredItems }
}
