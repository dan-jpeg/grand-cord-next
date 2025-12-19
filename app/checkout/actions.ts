'use server'

import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'
import { generateOrderNumber } from '@/lib/utils'

type OrderData = {
    email: string
    shippingAddress: {
        name: string
        address: string
        city: string
        state: string
        zip: string
        country: string
    }
    items: {
        productId: string
        productName: string
        productSlug: string
        size: string
        quantity: number
        price: number
    }[]
    total: number
}

export async function createCheckoutSession(data: OrderData) {
    const order = await prisma.order.create({
        data: {
            orderNumber: generateOrderNumber(),
            email: data.email,
            status: 'PENDING',
            total: data.total,
            shippingAddress: data.shippingAddress,
            stripePaymentIntentId: 'pending',
            items: {
                create: data.items,
            },
        },
    })

    const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: data.items.map((item) => ({
            price_data: {
                currency: 'usd',
                product_data: {
                    name: item.productName,
                    description: `Size: ${item.size}`,
                },
                unit_amount: Math.round(item.price * 100),
            },
            quantity: item.quantity,
        })),
        mode: 'payment',
        success_url: `${process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'}/order/${order.orderNumber}?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'}/checkout`,
        customer_email: data.email,
        metadata: {
            orderId: order.id,
            orderNumber: order.orderNumber,
        },
    })

    await prisma.order.update({
        where: { id: order.id },
        data: {
            stripePaymentIntentId: session.id,
        },
    })

    return { url: session.url, orderNumber: order.orderNumber }
}