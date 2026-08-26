import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { prisma } from '@/lib/prisma'
import { cancelOrder } from '@/lib/orders/cancel-order'
import { sendOrderConfirmationEmail } from '@/lib/email/order-emails'
import type { StockActor } from '@/lib/orders/stock'
import Stripe from 'stripe'

/**
 * Stripe is not a person, but it moves stock, so the audit rows need someone to
 * point at. `id` stays null because `adminUserId` is a foreign key.
 */
const WEBHOOK_ACTOR: StockActor = {
    id: null,
    email: 'stripe-webhook',
    name: 'Stripe webhook',
}

/**
 * A session's order is paid.
 *
 * Guarded on the order still being PENDING rather than written unconditionally.
 * A cancelled order — refunded, stock already returned to `available` — that
 * then received a delayed completion event used to flip back to PAID with
 * nothing re-committed, quietly overselling the difference.
 */
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
    const orderId = session.metadata?.orderId
    if (!orderId) return

    if (session.payment_status !== 'paid') {
        console.warn(
            `Ignoring checkout.session.completed for order ${session.metadata?.orderNumber}: ` +
                `payment_status is "${session.payment_status}", not "paid".`,
        )
        return
    }

    const order = await prisma.order.findUnique({
        where: { id: orderId },
        select: { total: true, orderNumber: true },
    })
    if (!order) {
        console.error(`checkout.session.completed names order ${orderId}, which does not exist.`)
        return
    }

    // Not fatal — the money is already taken and Stripe's figure is the one
    // that matters — but a mismatch means something is wrong upstream and
    // should never pass unremarked.
    const expectedCents = Math.round(order.total * 100)
    if (session.amount_total !== null && session.amount_total !== expectedCents) {
        console.error(
            `Amount mismatch on order ${order.orderNumber}: Stripe charged ` +
                `${session.amount_total} cents, the order records ${expectedCents}.`,
        )
    }

    const { count } = await prisma.order.updateMany({
        where: { id: orderId, status: 'PENDING' },
        data: {
            status: 'PAID',
            stripePaymentIntentId: session.payment_intent as string,
        },
    })

    if (count === 0) {
        // Either a replayed event or an order that has moved on since. Both are
        // fine to ignore, but not fine to ignore silently.
        console.warn(
            `Order ${order.orderNumber} was not PENDING when its completion event arrived; ` +
                `left untouched.`,
        )
        return
    }

    console.log(`✅ Order ${order.orderNumber} marked as PAID`)

    // Only on the call that actually moved the order, which the updateMany
    // guard above already establishes — a replayed event returns before it.
    //
    // Must not throw. A failure here would return 500, Stripe would redeliver,
    // and the redelivery would find the order no longer PENDING and return
    // early — leaving the order correctly PAID and the customer never told.
    // `sendOrderConfirmationEmail` swallows its own errors into a FAILED row
    // for exactly this reason.
    await sendOrderConfirmationEmail(orderId)
}

/**
 * The customer never paid and the window closed. Release the reservation.
 *
 * Runs through `cancelOrder` rather than decrementing `committed` directly.
 * The old inline loop had no floor on the decrement and no transaction, so an
 * expiry racing an admin cancel drove `committed` negative — which is exactly
 * how the 999C row ended up at -1. `applyOrderStockMove` clamps to what is
 * actually reserved and writes an audit row for each movement.
 *
 * Idempotent: cancelling an already-cancelled order is a no-op.
 */
async function handleCheckoutExpired(session: Stripe.Checkout.Session) {
    const orderId = session.metadata?.orderId
    if (!orderId) return

    const order = await prisma.order.findUnique({
        where: { id: orderId },
        select: { status: true, orderNumber: true },
    })
    if (!order) {
        console.error(`checkout.session.expired names order ${orderId}, which does not exist.`)
        return
    }
    if (order.status !== 'PENDING') {
        console.warn(
            `Order ${order.orderNumber} was ${order.status} when its expiry event arrived; ` +
                `left untouched.`,
        )
        return
    }

    // Nothing was ever captured on an expired checkout, so there is nothing to
    // hand back.
    const result = await cancelOrder(orderId, 'NO_REFUND', WEBHOOK_ACTOR)

    if (result.unrestoredItems.length > 0) {
        console.error(
            `Stock could not be fully restored for expired order ${order.orderNumber}:\n  ` +
                result.unrestoredItems.join('\n  '),
        )
    }
    console.log(`♻️ Stock restored for expired order ${order.orderNumber}`)
}

export async function POST(req: Request) {
    const body = await req.text()
    const headersList = await headers()
    const signature = headersList.get('stripe-signature')

    if (!signature) {
        return NextResponse.json({ error: 'No signature' }, { status: 400 })
    }

    let event: Stripe.Event

    try {
        event = stripe.webhooks.constructEvent(
            body,
            signature,
            process.env.STRIPE_WEBHOOK_SECRET!
        )
    } catch (err) {
        console.error('Webhook signature verification failed:', err)
        return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }

    // Failures return 500 so Stripe retries on its own schedule. These handlers
    // used to catch, log and return 200 regardless, which told Stripe the work
    // was done — one transient database error permanently lost a PAID
    // transition with the money already taken.
    //
    // That makes redelivery routine, so every handler above is written to be
    // safe to run twice: each one guards on the order's current status and
    // no-ops when it has already moved.
    try {
        switch (event.type) {
            case 'checkout.session.completed':
                await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session)
                break

            case 'checkout.session.expired':
                await handleCheckoutExpired(event.data.object as Stripe.Checkout.Session)
                break

            case 'payment_intent.payment_failed':
                console.log('❌ Payment failed:', (event.data.object as Stripe.PaymentIntent).id)
                break

            default:
                console.log(`Unhandled event type: ${event.type}`)
        }
    } catch (error) {
        console.error(`Webhook handler failed for ${event.type} (${event.id}):`, error)
        return NextResponse.json({ error: 'Handler failed' }, { status: 500 })
    }

    return NextResponse.json({ received: true })
}
