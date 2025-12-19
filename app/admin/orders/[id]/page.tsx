import { prisma } from '@/lib/prisma'
import { formatPrice } from '@/lib/utils'
import { notFound } from 'next/navigation'
import { OrderStatusForm } from '@/components/admin/order-status-form'

import { OrderItem  } from "@prisma/client";

export default async function OrderDetailPage({
                                                  params,
                                              }: {
    params: Promise<{ id: string }>
}) {
    const { id } = await params

    const order = await prisma.order.findUnique({
        where: { id },
        include: {
            items: true,
        },
    })

    if (!order) {
        notFound()
    }

    const shippingAddress = order.shippingAddress as {
        name: string
        address: string
        city: string
        state: string
        zip: string
        country: string
    }

    return (
        <div className="max-w-5xl mx-auto px-6 py-8">
            <div className="mb-8">
                <h2 className="text-2xl font-bold mb-2">Order {order.orderNumber}</h2>
                <p className="text-neutral-600">
                    Placed on {new Date(order.createdAt).toLocaleDateString()} at{' '}
                    {new Date(order.createdAt).toLocaleTimeString()}
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Content */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Order Items */}
                    <div className="bg-white border border-neutral-200 p-6">
                        <h3 className="font-bold mb-4">Items</h3>
                        <div className="space-y-4">
                            {order.items.map((item: OrderItem) => (
                                <div key={item.id} className="flex justify-between">
                                    <div>
                                        <div className="font-medium">{item.productName}</div>
                                        <div className="text-sm text-neutral-600">
                                            Size: {item.size} • Qty: {item.quantity}
                                        </div>
                                    </div>
                                    <div className="font-medium">{formatPrice(item.price * item.quantity)}</div>
                                </div>
                            ))}
                            <div className="border-t border-neutral-200 pt-4 flex justify-between font-bold">
                                <span>Total</span>
                                <span>{formatPrice(order.total)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Customer Info */}
                    <div className="bg-white border border-neutral-200 p-6">
                        <h3 className="font-bold mb-4">Customer</h3>
                        <div className="space-y-2">
                            <div>
                                <div className="text-sm text-neutral-600">Email</div>
                                <div>{order.email}</div>
                            </div>
                        </div>
                    </div>

                    {/* Shipping Address */}
                    <div className="bg-white border border-neutral-200 p-6">
                        <h3 className="font-bold mb-4">Shipping Address</h3>
                        <div>
                            <div>{shippingAddress.name}</div>
                            <div>{shippingAddress.address}</div>
                            <div>
                                {shippingAddress.city}, {shippingAddress.state} {shippingAddress.zip}
                            </div>
                            <div>{shippingAddress.country}</div>
                        </div>
                    </div>
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                    {/* Status Management */}
                    <div className="bg-white border border-neutral-200 p-6">
                        <h3 className="font-bold mb-4">Order Status</h3>
                        <OrderStatusForm order={order} />
                    </div>

                    {/* Payment Info */}
                    <div className="bg-white border border-neutral-200 p-6">
                        <h3 className="font-bold mb-4">Payment</h3>
                        <div className="space-y-2 text-sm">
                            <div>
                                <div className="text-neutral-600">Stripe Payment ID</div>
                                <div className="font-mono text-xs break-all">{order.stripePaymentIntentId}</div>
                            </div>
                        </div>
                    </div>

                    {/* Notes */}
                    {order.notes && (
                        <div className="bg-white border border-neutral-200 p-6">
                            <h3 className="font-bold mb-4">Notes</h3>
                            <p className="text-sm text-neutral-600">{order.notes}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}