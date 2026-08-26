'use server'

import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/require-admin'
import { cancelOrder as cancelOrderCore } from '@/lib/orders/cancel-order'
import { getRefundableCents } from '@/lib/orders/refunds'
import { stripe } from '@/lib/stripe'
import { transitionOrderStatus } from '@/lib/orders/transition'
import { getCheapestQuote, buyLabel, type ShippoQuote } from '@/lib/shippo'
import { revalidatePath } from 'next/cache'

export async function markOrderShipped(orderId: string, trackingNumber?: string) {
    const actor = await requireAdmin()

    // Was a bare order.update. Stock never came off the shelf and nothing was
    // audited, which is how reverting one of these orders came to invent
    // inventory.
    const { warnings } = await transitionOrderStatus(orderId, 'SHIPPED', actor, {
        trackingNumber,
    })

    revalidatePath('/admin/orders')
    revalidatePath('/admin/pick')
    revalidatePath('/admin/products')

    return { warnings }
}

export async function quoteShippoLabel(orderId: string): Promise<ShippoQuote> {
    await requireAdmin()

    const order = await prisma.order.findUnique({
        where: { id: orderId },
        select: { shippingAddress: true },
    })
    if (!order) throw new Error('Order not found')

    const addr = (order.shippingAddress as Record<string, string>) ?? {}
    return getCheapestQuote({
        name: addr.name ?? '',
        street1: addr.address ?? '',
        city: addr.city ?? '',
        state: addr.state ?? '',
        zip: addr.zip ?? '',
        country: addr.country || 'US',
    })
}

export async function purchaseShippoLabel(orderId: string, rateId: string): Promise<{
    labelUrl: string
    trackingNumber: string
}> {
    const actor = await requireAdmin()

    const result = await buyLabel(rateId)

    // The label is already bought and paid for by the time we get here, so a
    // refused transition must not lose the tracking number — an admin who sees
    // only "stock has drifted" would have no way back to the label they just
    // purchased.
    try {
        await transitionOrderStatus(orderId, 'SHIPPED', actor, {
            trackingNumber: result.trackingNumber,
            trackingUrl: result.trackingUrl ?? undefined,
        })
    } catch (e) {
        const reason = e instanceof Error ? e.message : 'the order could not be marked shipped'
        throw new Error(
            `The label was purchased (tracking ${result.trackingNumber}, ${result.labelUrl}) ` +
                `but the order was not marked shipped: ${reason}`,
        )
    }

    revalidatePath('/admin/orders')
    revalidatePath('/admin/pick')
    revalidatePath('/admin/products')

    return {
        labelUrl: result.labelUrl,
        trackingNumber: result.trackingNumber,
    }
}

export async function partialRefundItem(orderId: string, amountCents: number) {
    await requireAdmin()

    const order = await prisma.order.findUnique({
        where: { id: orderId },
        select: { stripePaymentIntentId: true },
    })
    if (!order?.stripePaymentIntentId || order.stripePaymentIntentId === 'pending') return

    if (!Number.isInteger(amountCents) || amountCents <= 0) {
        throw new Error('Refund amount must be a positive whole number of cents.')
    }

    // Never hand back more than the payment still holds, however this is called.
    const refundable = await getRefundableCents(order.stripePaymentIntentId)
    if (refundable <= 0) {
        throw new Error('This payment has already been fully refunded.')
    }
    if (amountCents > refundable) {
        throw new Error(
            `Refund of ${amountCents} cents exceeds the ${refundable} cents still refundable.`,
        )
    }

    await stripe.refunds.create({
        payment_intent: order.stripePaymentIntentId,
        amount: amountCents,
    })
}

/**
 * Cancel from the pick flow. The sheet's own button states the outcome ("Full
 * refund, remove from queue"), so the choice is already explicit here — but it
 * runs the same canonical path as the order screen, which also means the stock
 * now comes back, something this route previously skipped.
 */
export async function cancelOrder(orderId: string) {
    const actor = await requireAdmin()

    const result = await cancelOrderCore(orderId, 'FULL_REFUND', actor)

    revalidatePath('/admin/orders')
    revalidatePath('/admin/pick')
    revalidatePath('/admin/products')

    return result
}
