import type { OrderEmailKind, Order, OrderItem } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getRefundedCents, hasUsablePaymentIntent } from '@/lib/orders/refunds'
import { isEmailConfigured, sendEmail, type EmailMessage } from '@/lib/email/send'
import { orderCancelledEmail } from '@/lib/email/templates/order-cancelled'
import { orderConfirmedEmail } from '@/lib/email/templates/order-confirmed'
import { orderShippedEmail } from '@/lib/email/templates/order-shipped'

export type OrderEmailOutcome =
    | { status: 'sent' }
    /** Mail is not configured in this environment. Nothing was recorded. */
    | { status: 'disabled' }
    /** This customer has already been told. A replay, or a re-shipped order. */
    | { status: 'already-sent' }
    | { status: 'failed'; error: string }

type OrderWithItems = Order & { items: OrderItem[] }

/**
 * Claim the one slot for (order, kind), send, and record the result.
 *
 * The slot is claimed *before* the provider is called rather than written
 * after, because the failure that matters is the one where the message goes out
 * and the record of it does not: that one mails the customer again on the next
 * replay. Losing a send instead leaves a FAILED row somebody can act on.
 *
 * `skipDuplicates` turns the unique constraint into the check, so two
 * concurrent callers cannot both win it.
 *
 * Never throws. Every caller is either a Stripe webhook — where an exception
 * means a retry that finds the order already moved on and so never mails at all
 * — or an admin action that has already shipped goods. No email is worth
 * failing either one.
 */
async function dispatch(
    orderId: string,
    kind: OrderEmailKind,
    build: (order: OrderWithItems) => EmailMessage,
): Promise<OrderEmailOutcome> {
    if (!isEmailConfigured()) {
        console.log(`✉️  Email is not configured; skipping ${kind} for order ${orderId}.`)
        return { status: 'disabled' }
    }

    const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: { items: true },
    })
    if (!order) {
        console.error(`Cannot send ${kind} for ${orderId}: the order does not exist.`)
        return { status: 'failed', error: 'Order not found' }
    }

    const { count } = await prisma.orderEmail.createMany({
        data: [{ orderId: order.id, orderNumber: order.orderNumber, kind, to: order.email }],
        skipDuplicates: true,
    })
    if (count === 0) return { status: 'already-sent' }

    try {
        const { providerMessageId } = await sendEmail(build(order))
        await prisma.orderEmail.update({
            where: { orderId_kind: { orderId: order.id, kind } },
            data: { status: 'SENT', providerMessageId },
        })
        console.log(`✉️  ${kind} sent for order ${order.orderNumber}`)
        return { status: 'sent' }
    } catch (e) {
        const error = e instanceof Error ? e.message : 'The message could not be sent.'
        // Recording the failure is best-effort too: if the database is what
        // broke, there is nothing useful left to do but say so in the log.
        await prisma.orderEmail
            .update({
                where: { orderId_kind: { orderId: order.id, kind } },
                data: { status: 'FAILED', error },
            })
            .catch(() => {})
        console.error(`✉️  ${kind} FAILED for order ${order.orderNumber}: ${error}`)
        return { status: 'failed', error }
    }
}

/** Payment cleared. Sent from the Stripe webhook, once, on the PENDING → PAID move. */
export async function sendOrderConfirmationEmail(orderId: string): Promise<OrderEmailOutcome> {
    return dispatch(orderId, 'ORDER_CONFIRMED', (order) => ({
        to: order.email,
        ...orderConfirmedEmail({
            orderNumber: order.orderNumber,
            total: order.total,
            items: order.items,
            shippingAddress: order.shippingAddress,
        }),
    }))
}

/** Goods are out the door. Sent from the tail of `transitionOrderStatus`. */
export async function sendOrderShippedEmail(orderId: string): Promise<OrderEmailOutcome> {
    return dispatch(orderId, 'ORDER_SHIPPED', (order) => ({
        to: order.email,
        ...orderShippedEmail({
            orderNumber: order.orderNumber,
            total: order.total,
            trackingNumber: order.trackingNumber,
            trackingUrl: order.trackingUrl,
            items: order.items,
            shippingAddress: order.shippingAddress,
        }),
    }))
}

/**
 * A paid order has been cancelled.
 *
 * `refundedCents` is what Stripe actually returned, passed in rather than
 * re-read: the refund happens before the status write in `cancelOrder`, and
 * re-querying afterwards would report the same number at best and a stale one
 * at worst.
 *
 * Not sent for orders cancelled out of PENDING — an expired checkout is an
 * abandoned cart, and telling someone their order is cancelled when they never
 * completed one is confusing. That gate lives at the call site, which is the
 * only place that still knows the previous status.
 */
export async function sendOrderCancelledEmail(
    orderId: string,
    opts: { refundedCents: number },
): Promise<OrderEmailOutcome> {
    return dispatch(orderId, 'ORDER_CANCELLED', (order) => ({
        to: order.email,
        ...orderCancelledEmail({
            orderNumber: order.orderNumber,
            total: order.total,
            items: order.items,
            refundedCents: opts.refundedCents,
            supportEmail: process.env.EMAIL_REPLY_TO || null,
        }),
    }))
}

/**
 * Send one order email again, discarding whatever the previous attempt
 * recorded.
 *
 * The claim row is what stops an email sending twice, so a deliberate resend
 * has to clear it first — there is no other way past a constraint whose whole
 * job is to refuse the second send. Delete then dispatch is not atomic: if the
 * process dies between the two, the slot is simply free and the next click
 * sends. That is the harmless direction to fail in.
 *
 * The caller is responsible for deciding the kind makes sense for the order's
 * current status; `app/admin/emails/actions.ts` holds that rule.
 */
export async function resendOrderEmail(
    orderId: string,
    kind: OrderEmailKind,
): Promise<OrderEmailOutcome> {
    await prisma.orderEmail.deleteMany({ where: { orderId, kind } })

    if (kind === 'ORDER_CONFIRMED') return sendOrderConfirmationEmail(orderId)
    if (kind === 'ORDER_SHIPPED') return sendOrderShippedEmail(orderId)

    // A cancellation's refund figure was never stored — it is whatever Stripe
    // actually returned, so Stripe is where it has to come from now.
    const order = await prisma.order.findUnique({
        where: { id: orderId },
        select: { stripePaymentIntentId: true },
    })
    let refundedCents = 0
    const intentId = order?.stripePaymentIntentId
    if (hasUsablePaymentIntent(intentId)) {
        try {
            refundedCents = await getRefundedCents(intentId)
        } catch (e) {
            // Better to send with no refund line than to claim an amount we
            // could not confirm, or to fail the resend outright.
            console.error(
                `Could not read the refunded amount for ${orderId}; ` +
                    `sending the cancellation without a refund line: ` +
                    `${e instanceof Error ? e.message : e}`,
            )
        }
    }
    return sendOrderCancelledEmail(orderId, { refundedCents })
}
