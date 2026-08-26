import { stripe } from '@/lib/stripe'

/**
 * Read-only questions about what a payment has done.
 *
 * Split out from cancel-order.ts so that the email layer can ask them without
 * importing the module that cancels orders — which imports the email layer in
 * turn. The cycle typechecked and would probably even have run, but a circular
 * ESM binding is not something to leave in the path of a refund.
 */

/**
 * Whether the column actually holds a payment intent.
 *
 * It holds three different things across an order's life: the sentinel
 * `'pending'`, then the checkout session id (`cs_…`), and only after
 * `checkout.session.completed` an actual payment intent.
 */
export function hasUsablePaymentIntent(id: string | null | undefined): id is string {
    return !!id && id !== 'pending' && !id.startsWith('cs_')
}

/**
 * How much of the payment can still be handed back, in cents. Reads Stripe
 * rather than the order total so that partial refunds already issued from the
 * pick flow are accounted for.
 */
export async function getRefundableCents(paymentIntentId: string): Promise<number> {
    const charge = await latestCharge(paymentIntentId)
    if (!charge) return 0
    return Math.max(0, charge.amount_captured - charge.amount_refunded)
}

/**
 * How much has actually been handed back, in cents. Needed when re-sending a
 * cancellation notice, where the original figure is long gone and Stripe is the
 * only thing that still knows what really moved.
 */
export async function getRefundedCents(paymentIntentId: string): Promise<number> {
    const charge = await latestCharge(paymentIntentId)
    return charge?.amount_refunded ?? 0
}

async function latestCharge(paymentIntentId: string) {
    const intent = await stripe.paymentIntents.retrieve(paymentIntentId, {
        expand: ['latest_charge'],
    })
    return intent.latest_charge && typeof intent.latest_charge !== 'string'
        ? intent.latest_charge
        : null
}
