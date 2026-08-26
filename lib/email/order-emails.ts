import type { OrderEmailKind } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { isEmailConfigured, sendEmail } from '@/lib/email/send'
import { orderShippedEmail } from '@/lib/email/templates/order-shipped'

export type OrderEmailOutcome =
    | { status: 'sent' }
    /** Mail is not configured in this environment. Nothing was recorded. */
    | { status: 'disabled' }
    /** This customer has already been told. A replay, or a re-shipped order. */
    | { status: 'already-sent' }
    | { status: 'failed'; error: string }

/**
 * Claim the one slot for (order, kind).
 *
 * Claimed before the provider is called rather than written after, because the
 * failure that matters is the one where the message goes out and the record of
 * it does not. Losing a record means the next replay mails the customer again;
 * losing a send is visible in the log as a FAILED row somebody can act on.
 *
 * `skipDuplicates` turns the unique constraint into the check — two concurrent
 * callers cannot both win it.
 */
async function claimSlot(
    orderId: string,
    orderNumber: string,
    kind: OrderEmailKind,
    to: string,
): Promise<boolean> {
    const { count } = await prisma.orderEmail.createMany({
        data: [{ orderId, orderNumber, kind, to }],
        skipDuplicates: true,
    })
    return count === 1
}

async function record(
    orderId: string,
    kind: OrderEmailKind,
    data: { status: 'SENT'; providerMessageId: string } | { status: 'FAILED'; error: string },
) {
    await prisma.orderEmail.update({
        where: { orderId_kind: { orderId, kind } },
        data,
    })
}

/**
 * Tell the customer their order is on its way.
 *
 * Never throws. Called from the tail of `transitionOrderStatus`, where an
 * exception would surface to an admin who has already bought a shipping label
 * and moved stock — a mail problem must not read as a shipping problem.
 */
export async function sendOrderShippedEmail(orderId: string): Promise<OrderEmailOutcome> {
    if (!isEmailConfigured()) {
        console.log(`✉️  Email is not configured; skipping shipped notice for order ${orderId}.`)
        return { status: 'disabled' }
    }

    const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: { items: true },
    })
    if (!order) {
        console.error(`Cannot send a shipped notice for ${orderId}: the order does not exist.`)
        return { status: 'failed', error: 'Order not found' }
    }

    const claimed = await claimSlot(order.id, order.orderNumber, 'ORDER_SHIPPED', order.email)
    if (!claimed) return { status: 'already-sent' }

    try {
        const message = orderShippedEmail({
            orderNumber: order.orderNumber,
            total: order.total,
            trackingNumber: order.trackingNumber,
            trackingUrl: order.trackingUrl,
            items: order.items,
            shippingAddress: order.shippingAddress,
        })

        const { providerMessageId } = await sendEmail({ to: order.email, ...message })
        await record(order.id, 'ORDER_SHIPPED', { status: 'SENT', providerMessageId })
        console.log(`✉️  Shipped notice sent for order ${order.orderNumber}`)
        return { status: 'sent' }
    } catch (e) {
        const error = e instanceof Error ? e.message : 'The message could not be sent.'
        // Recording the failure is best-effort too: if the database is what
        // broke, there is nothing useful left to do but say so in the log.
        await record(order.id, 'ORDER_SHIPPED', { status: 'FAILED', error }).catch(() => {})
        console.error(`✉️  Shipped notice FAILED for order ${order.orderNumber}: ${error}`)
        return { status: 'failed', error }
    }
}
