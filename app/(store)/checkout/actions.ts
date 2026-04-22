'use server'

import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'
import { revalidatePath } from 'next/cache'

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



    // Create order
    export async function createCheckoutSession(data: OrderData) {
        // Check stock availability before creating order
        for (const item of data.items) {
            const productSize = await prisma.productSize.findFirst({
                where: {
                    productId: item.productId,
                    size: item.size,
                },
            })

            if (!productSize) {
                throw new Error(`Size ${item.size} not found for ${item.productName}`)
            }

            if (productSize.available < item.quantity) {
                throw new Error(`Not enough stock for ${item.productName} (${item.size}). Only ${productSize.available} available.`)
            }
        }

        // Generate sequential order number
        const orderCount = await prisma.order.count()
        const orderNumber = String(orderCount + 1).padStart(4, '0')

        // Create order
        const order = await prisma.order.create({
            data: {
                orderNumber,
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

        // Move stock from available to committed
        for (const item of data.items) {
            await prisma.productSize.updateMany({
                where: {
                    productId: item.productId,
                    size: item.size,
                },
                data: {
                    available: {
                        decrement: item.quantity,
                    },
                    committed: {
                        increment: item.quantity,
                    },
                },
            })
        }

        revalidatePath('/admin/products')


    // Create Stripe checkout session
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