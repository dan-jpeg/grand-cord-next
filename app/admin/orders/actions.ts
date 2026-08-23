'use server'

import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { requireAdmin } from '@/lib/require-admin'
import { stripe } from '@/lib/stripe'
import {
    cancelOrder as cancelOrderCore,
    getRefundableCents,
    type CancelResult,
    type RefundChoice,
} from '@/lib/orders/cancel-order'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function updateOrderStatus(
    orderId: string,
    status: 'PENDING' | 'PAID' | 'SHIPPED' | 'CANCELLED',
    trackingNumber?: string,
    trackingUrl?: string
) {
    await requireAdmin()

    // Cancellation carries a refund decision, so it cannot be expressed as a
    // plain status write. Callers go through cancelOrderAction instead.
    if (status === 'CANCELLED') {
        throw new Error('Use cancelOrderAction to cancel an order.')
    }

    const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: { items: true },
    })

    if (!order) throw new Error('Order not found')

    const previousStatus = order.status

    // Update order status
    await prisma.order.update({
        where: { id: orderId },
        data: {
            status,
            // Clear tracking if not SHIPPED
            trackingNumber: status === 'SHIPPED' ? (trackingNumber || order.trackingNumber) : null,
            trackingUrl: status === 'SHIPPED' ? (trackingUrl || order.trackingUrl) : null,
        },
    })

    // Handle inventory changes based on status transition
    if (previousStatus === 'PAID' && status === 'SHIPPED') {
        // Order shipped: decrement committed and total
        for (const item of order.items) {
            await prisma.productSize.updateMany({
                where: {
                    productId: item.productId,
                    size: item.size,
                },
                data: {
                    committed: {
                        decrement: item.quantity,
                    },
                    total: {
                        decrement: item.quantity,
                    },
                },
            })
        }
    }

    revalidatePath('/admin/orders')
    revalidatePath(`/admin/orders/${orderId}`)
    revalidatePath('/admin/products')
    redirect('/admin/orders')
}

export type PaymentInfo = {
    paymentIntentId: string
    status: string
    amount: number
    amountReceived: number
    currency: string
    created: string | null
    receiptUrl: string | null
    refunded: boolean
    amountRefunded: number
    chargeId: string | null
    fee: number | null
    net: number | null
    card: {
        brand: string | null
        last4: string | null
        expMonth: number | null
        expYear: number | null
        funding: string | null
        country: string | null
        wallet: string | null
    } | null
    billing: {
        name: string | null
        email: string | null
        phone: string | null
        line1: string | null
        line2: string | null
        city: string | null
        state: string | null
        postalCode: string | null
        country: string | null
    } | null
}

// Pulls the live Stripe record for an order. Read-only — the admin Payment Info
// modal is the only caller.
export async function getOrderPaymentInfo(
    orderId: string,
): Promise<{ ok: true; payment: PaymentInfo } | { ok: false; error: string }> {
    const session = await auth()
    if (!session) return { ok: false, error: 'Unauthorized' }

    const order = await prisma.order.findUnique({
        where: { id: orderId },
        select: { stripePaymentIntentId: true },
    })
    if (!order) return { ok: false, error: 'Order not found' }
    if (!order.stripePaymentIntentId) {
        return { ok: false, error: 'No Stripe payment is attached to this order.' }
    }

    try {
        const intent = await stripe.paymentIntents.retrieve(order.stripePaymentIntentId, {
            expand: ['latest_charge.balance_transaction'],
        })

        const charge =
            intent.latest_charge && typeof intent.latest_charge !== 'string'
                ? intent.latest_charge
                : null
        const balanceTx =
            charge?.balance_transaction && typeof charge.balance_transaction !== 'string'
                ? charge.balance_transaction
                : null
        const cardDetails = charge?.payment_method_details?.card ?? null
        const billing = charge?.billing_details ?? null

        return {
            ok: true,
            payment: {
                paymentIntentId: intent.id,
                status: intent.status,
                amount: intent.amount,
                amountReceived: intent.amount_received,
                currency: intent.currency,
                created: new Date(intent.created * 1000).toISOString(),
                receiptUrl: charge?.receipt_url ?? null,
                refunded: charge?.refunded ?? false,
                amountRefunded: charge?.amount_refunded ?? 0,
                chargeId: charge?.id ?? null,
                fee: balanceTx?.fee ?? null,
                net: balanceTx?.net ?? null,
                card: cardDetails
                    ? {
                          brand: cardDetails.brand ?? null,
                          last4: cardDetails.last4 ?? null,
                          expMonth: cardDetails.exp_month ?? null,
                          expYear: cardDetails.exp_year ?? null,
                          funding: cardDetails.funding ?? null,
                          country: cardDetails.country ?? null,
                          wallet: cardDetails.wallet?.type ?? null,
                      }
                    : null,
                billing: billing
                    ? {
                          name: billing.name ?? null,
                          email: billing.email ?? null,
                          phone: billing.phone ?? null,
                          line1: billing.address?.line1 ?? null,
                          line2: billing.address?.line2 ?? null,
                          city: billing.address?.city ?? null,
                          state: billing.address?.state ?? null,
                          postalCode: billing.address?.postal_code ?? null,
                          country: billing.address?.country ?? null,
                      }
                    : null,
            },
        }
    } catch (e) {
        return {
            ok: false,
            error: e instanceof Error ? e.message : 'Could not reach Stripe.',
        }
    }
}

/**
 * How much can still be refunded on an order, for the cancel prompt to show
 * before the admin commits. Returns null when there is nothing to refund.
 */
export async function getOrderRefundableCents(
    orderId: string,
): Promise<{ ok: true; cents: number } | { ok: false; error: string }> {
    await requireAdmin()

    const order = await prisma.order.findUnique({
        where: { id: orderId },
        select: { stripePaymentIntentId: true },
    })
    if (!order) return { ok: false, error: 'Order not found' }
    if (!order.stripePaymentIntentId || order.stripePaymentIntentId === 'pending') {
        return { ok: false, error: 'No Stripe payment is attached to this order.' }
    }

    try {
        return { ok: true, cents: await getRefundableCents(order.stripePaymentIntentId) }
    } catch (e) {
        return {
            ok: false,
            error: e instanceof Error ? e.message : 'Could not reach Stripe.',
        }
    }
}

/**
 * The only way to cancel an order from the admin. The refund decision is made
 * by the admin at cancel time and passed explicitly.
 */
export async function cancelOrderAction(
    orderId: string,
    refundChoice: RefundChoice,
): Promise<{ ok: true; result: CancelResult } | { ok: false; error: string }> {
    await requireAdmin()

    try {
        const result = await cancelOrderCore(orderId, refundChoice)
        revalidatePath('/admin/orders')
        revalidatePath(`/admin/orders/${orderId}`)
        revalidatePath('/admin/products')
        revalidatePath('/admin/pick')
        return { ok: true, result }
    } catch (e) {
        // A failed refund leaves the order untouched, so the admin can retry.
        return {
            ok: false,
            error: e instanceof Error ? e.message : 'Could not cancel the order.',
        }
    }
}
