'use server'

import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'
import { revalidatePath } from 'next/cache'

export async function markOrderShipped(orderId: string) {
    await prisma.order.update({
        where: { id: orderId },
        data: { status: 'SHIPPED' },
    })
    revalidatePath('/admin/orders')
    revalidatePath('/admin/pick')
}

export async function partialRefundItem(orderId: string, amountCents: number) {
    const order = await prisma.order.findUnique({
        where: { id: orderId },
        select: { stripePaymentIntentId: true },
    })
    if (!order?.stripePaymentIntentId || order.stripePaymentIntentId === 'pending') return

    await stripe.refunds.create({
        payment_intent: order.stripePaymentIntentId,
        amount: amountCents,
    })
}

export async function cancelOrder(orderId: string) {
    const order = await prisma.order.findUnique({
        where: { id: orderId },
        select: { stripePaymentIntentId: true },
    })

    if (order?.stripePaymentIntentId && order.stripePaymentIntentId !== 'pending') {
        await stripe.refunds.create({
            payment_intent: order.stripePaymentIntentId,
        })
    }

    await prisma.order.update({
        where: { id: orderId },
        data: { status: 'CANCELLED' },
    })

    revalidatePath('/admin/orders')
    revalidatePath('/admin/pick')
}
