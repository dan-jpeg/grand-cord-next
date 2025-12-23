import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { prisma } from '@/lib/prisma'
import Stripe from 'stripe'

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

    switch (event.type) {
        case 'checkout.session.completed':
            const session = event.data.object as Stripe.Checkout.Session

            if (session.metadata?.orderId) {
                try {
                    await prisma.order.update({
                        where: { id: session.metadata.orderId },
                        data: {
                            status: 'PAID',
                            stripePaymentIntentId: session.payment_intent as string,
                        },
                    })

                    console.log(`✅ Order ${session.metadata.orderNumber} marked as PAID`)
                } catch (error) {
                    console.error('Error updating order:', error)
                }
            }
            break

        case 'checkout.session.expired':
            const expiredSession = event.data.object as Stripe.Checkout.Session

            if (expiredSession.metadata?.orderId) {
                try {
                    const order = await prisma.order.findUnique({
                        where: { id: expiredSession.metadata.orderId },
                        include: { items: true },
                    })

                    if (order && order.status === 'PENDING') {
                        // Move stock from committed back to available
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
                                    available: {
                                        increment: item.quantity,
                                    },
                                },
                            })
                        }

                        // Cancel order
                        await prisma.order.update({
                            where: { id: order.id },
                            data: { status: 'CANCELLED' },
                        })

                        console.log(`♻️ Stock restored for expired order ${order.orderNumber}`)
                    }
                } catch (error) {
                    console.error('Error restoring stock:', error)
                }
            }
            break

        case 'payment_intent.payment_failed':
            const paymentIntent = event.data.object as Stripe.PaymentIntent
            console.log('❌ Payment failed:', paymentIntent.id)
            break

        default:
            console.log(`Unhandled event type: ${event.type}`)
    }

    return NextResponse.json({ received: true })
}