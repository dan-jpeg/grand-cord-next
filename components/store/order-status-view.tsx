'use client'

import { useState } from 'react'
import { formatPrice } from '@/lib/utils'
import { lookupOrder } from '@/app/(store)/cart/order-status/actions'

// Derived from the action rather than from the Prisma model: the action now
// selects an explicit subset, and a wider type here would be a lie about what
// actually reaches the browser.
type OrderWithItems = NonNullable<Awaited<ReturnType<typeof lookupOrder>>>

export function OrderStatusView() {
    const [orderNumber, setOrderNumber] = useState('')
    const [email, setEmail] = useState('')
    const [order, setOrder] = useState<OrderWithItems | null>(null)
    const [isSearching, setIsSearching] = useState(false)
    const [notFound, setNotFound] = useState(false)

    async function handleSearch(e: React.FormEvent) {
        e.preventDefault()
        setIsSearching(true)
        setNotFound(false)
        setOrder(null)

        try {
            const result = await lookupOrder(orderNumber.trim(), email.trim())
            if (result) {
                setOrder(result)
            } else {
                setNotFound(true)
            }
        } catch {
            setNotFound(true)
        } finally {
            setIsSearching(false)
        }
    }

    const shippingAddress = order?.shippingAddress as {
        name: string
        address: string
        city: string
        state: string
        zip: string
        country: string
    } | null

    return (
        <div className="min-h-[calc(100*var(--vh))] bg-white">
            <div className="max-w-2xl mx-auto px-8 py-16">
                <div className="border-b border-black pb-4 mb-8">
                    <h1 className="text-[9pt] font-bold uppercase">Order Status</h1>
                </div>

                {/* Search Form */}
                <form onSubmit={handleSearch} className="mb-12">
                    <label htmlFor="orderNumber" className="block text-[9pt] font-bold uppercase mb-2">
                        Order Number
                    </label>
                    <input
                        id="orderNumber"
                        type="text"
                        value={orderNumber}
                        onChange={(e) => setOrderNumber(e.target.value)}
                        placeholder="0001"
                        className="w-full px-4 py-3 border border-black focus:outline-none mb-4"
                        required
                    />

                    {/* Second factor: the order number alone is not a secret. */}
                    <label htmlFor="email" className="block text-[9pt] font-bold uppercase mb-2">
                        Email
                    </label>
                    <div className="flex gap-2">
                        <input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="the address you ordered with"
                            className="flex-1 px-4 py-3 border border-black focus:outline-none"
                            required
                        />
                        <button
                            type="submit"
                            disabled={isSearching}
                            className="bg-black text-white px-8 py-3 text-[9pt] uppercase font-bold hover:bg-neutral-800 disabled:opacity-50 transition-colors"
                        >
                            {isSearching ? 'Searching...' : 'Search'}
                        </button>
                    </div>
                </form>

                {/* Not Found Message */}
                {notFound && (
                    <div className="text-center py-8">
                        <p className="text-sm text-neutral-600">
                            No order matches that number and email. Check both and try again.
                        </p>
                    </div>
                )}

                {/* Order Details */}
                {order && (
                    <div className="border border-black p-6">
                        <div className="mb-6">
                            <div className="text-[9pt] text-neutral-600 mb-1">Order Number</div>
                            <div className="font-bold text-lg">{order.orderNumber}</div>
                        </div>

                        <div className="mb-6">
                            <div className="text-[9pt] text-neutral-600 mb-1">Status</div>
                            <div className="font-bold uppercase">
                                {order.status === 'PENDING' && 'Payment Pending'}
                                {order.status === 'PAID' && 'Processing'}
                                {order.status === 'SHIPPED' && 'Shipped'}
                                {order.status === 'CANCELLED' && 'Cancelled'}
                            </div>
                        </div>

                        {order.trackingNumber && (
                            <div className="mb-6">
                                <div className="text-[9pt] text-neutral-600 mb-1">Tracking Number</div>
                                {order.trackingUrl ? (
                                    <a
                                        href={order.trackingUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="font-bold underline hover:no-underline"
                                    >
                                        {order.trackingNumber}
                                    </a>
                                ) : (
                                    <div className="font-bold">{order.trackingNumber}</div>
                                )}
                            </div>
                        )}

                        <div className="border-t border-neutral-200 pt-6 mb-6">
                            <div className="text-[9pt] font-bold uppercase mb-4">Items</div>
                            <div className="space-y-3">
                                {order.items.map((item) => (
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

                        {shippingAddress && (
                            <div className="border-t border-neutral-200 pt-6 mb-6">
                                <div className="text-[9pt] font-bold uppercase mb-2">Shipping Address</div>
                                <div className="text-sm">
                                    <div>{shippingAddress.name}</div>
                                    <div>{shippingAddress.address}</div>
                                    <div>
                                        {shippingAddress.city}, {shippingAddress.state} {shippingAddress.zip}
                                    </div>
                                    <div>{shippingAddress.country}</div>
                                </div>
                            </div>
                        )}

                        <div className="border-t border-black pt-4">
                            <div className="flex justify-between items-center">
                                <span className="text-[9pt] font-bold uppercase">Total</span>
                                <span className="text-xl font-bold">{formatPrice(order.total)}</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}