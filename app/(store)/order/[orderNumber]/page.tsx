import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'
import { notFound } from 'next/navigation'
import { formatPrice } from '@/lib/utils'
import Link from 'next/link'

import { OrderItem } from "@prisma/client";

export default async function OrderConfirmationPage({
                                                        params,
                                                        searchParams,
                                                    }: {
    params: Promise<{ orderNumber: string }>
    searchParams: Promise<{ session_id?: string }>
}) {
    const { orderNumber } = await params
    const { session_id: sessionId } = await searchParams

    const order = await prisma.order.findUnique({
        where: { orderNumber },
        include: { items: true },
    })

    if (!order) {
        notFound()
    }

    // Order numbers are sequential and public, so the number alone cannot gate
    // this page — it shows the customer's email. Stripe's checkout session is
    // the proof of arrival: it is unguessable, and Stripe only hands it to the
    // person who completed this payment. Anyone returning later uses the order
    // status page, which asks for the email instead.
    if (!sessionId) {
        notFound()
    }

    // Resolved before the check so that notFound()'s control-flow throw is not
    // swallowed by this catch.
    const sessionOrderId = await stripe.checkout.sessions
        .retrieve(sessionId)
        .then((session) => session.metadata?.orderId ?? null)
        .catch(() => null)

    if (sessionOrderId !== order.id) {
        notFound()
    }

    return (
        <div className="min-h-[calc(100*var(--vh))] bg-white flex items-center justify-center p-8">
            <div className="max-w-2xl w-full">
                <div className="border border-black p-8">
                    <h1 className="text-2xl font-bold mb-4">Order Confirmed</h1>
                    <p className="text-sm text-neutral-600 mb-8">
                        Thank you for your order! We've sent a confirmation email to {order.email}.
                    </p>

                    <div className="mb-8">
                        <div className="text-[9pt] text-neutral-600 mb-1">Order Number</div>
                        <div className="font-bold">{order.orderNumber}</div>
                    </div>

                    <div className="border-t border-neutral-200 pt-6 mb-6">
                        <h2 className="text-[9pt] font-bold uppercase mb-4">Items</h2>
                        <div className="space-y-3">
                            {order.items.map((item: OrderItem) => (
                                <div key={item.id} className="flex justify-between text-sm">
                                    <div>
                                        <div className="font-bold">{item.productName}</div>
                                        <div className="text-[9pt] text-neutral-600">
                                            Size: {item.size} • Qty: {item.quantity}
                                        </div>
                                    </div>
                                    <div className="font-bold">
                                        {formatPrice(item.price * item.quantity)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="border-t border-black pt-4 mb-8">
                        <div className="flex justify-between items-center">
                            <span className="text-[9pt] font-bold uppercase">Total</span>
                            <span className="text-xl font-bold">{formatPrice(order.total)}</span>
                        </div>
                    </div>

                    <Link
                        href="/public"
                        className="block text-center bg-black text-white py-3 text-[9pt] uppercase font-bold hover:bg-neutral-800 transition-colors"
                    >
                        Continue Shopping
                    </Link>
                </div>
            </div>
        </div>
    )
}