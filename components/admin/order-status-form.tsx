'use client'

import { useState } from 'react'
import { updateOrderStatus } from '@/app/admin/orders/actions'
import type { LiveOrderStatus } from '@/lib/orders/transition'
import { CancelOrderPrompt } from '@/components/admin/cancel-order-prompt'
import type { Order, OrderStatus } from '@prisma/client'

export function OrderStatusForm({ order }: { order: Order }) {
    const [isEditing, setIsEditing] = useState(false)
    const [status, setStatus] = useState(order.status)
    const [trackingNumber, setTrackingNumber] = useState(order.trackingNumber || '')
    const [trackingUrl, setTrackingUrl] = useState(order.trackingUrl || '')
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [pendingCancel, setPendingCancel] = useState(false)

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()

        // Cancelling carries a refund decision, so it goes through its own sheet.
        if (status === 'CANCELLED') {
            setPendingCancel(true)
            return
        }

        setIsSubmitting(true)

        await updateOrderStatus(
            order.id,
            status as LiveOrderStatus,
            trackingNumber || undefined,
            trackingUrl || undefined
        )
    }

    // Show read-only view if shipped and not editing
    if (order.status === 'SHIPPED' && !isEditing) {
        return (
            <div className="relative">
                <button
                    onClick={() => setIsEditing(true)}
                    className="absolute -top-2 -right-2 p-2 hover:bg-neutral-100 rounded"
                    title="Edit order"
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                        <path d="m15 5 4 4" />
                    </svg>
                </button>

                <div className="space-y-4 text-sm">
                    <div>
                        <div className="text-neutral-600 mb-1">Status</div>
                        <div className="font-bold text-green-700 uppercase">SHIPPED</div>
                    </div>

                    {order.trackingNumber && (
                        <div>
                            <div className="text-neutral-600 mb-1">Tracking Number</div>
                            <div className="font-mono text-xs">{order.trackingNumber}</div>
                        </div>
                    )}

                    {order.trackingUrl && (
                        <div>
                            <div className="text-neutral-600 mb-1">Tracking URL</div>
                            <a
                                href={order.trackingUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs underline hover:no-underline break-all"
                            >
                                {order.trackingUrl}
                            </a>
                        </div>
                    )}
                </div>
            </div>
        )
    }

    return (
        <>
        {pendingCancel && (
            <CancelOrderPrompt
                orderId={order.id}
                orderNumber={order.orderNumber}
                onDone={() => {
                    setPendingCancel(false)
                    setIsEditing(false)
                }}
                onCancel={() => setPendingCancel(false)}
            />
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label htmlFor="status" className="block text-sm font-medium mb-2">
                    Status
                </label>
                <select
                    id="status"
                    value={status}
                    onChange={(e) => setStatus(e.target.value as OrderStatus)}
                    className="w-full px-4 py-3 border border-neutral-300 focus:outline-none focus:border-black"
                >
                    <option value="PENDING">Pending</option>
                    <option value="PAID">Paid</option>
                    <option value="SHIPPED">Shipped</option>
                    <option value="CANCELLED">Cancelled</option>
                </select>
            </div>

            {status === 'SHIPPED' && (
                <>
                    <div>
                        <label htmlFor="trackingNumber" className="block text-sm font-medium mb-2">
                            Tracking Number
                        </label>
                        <input
                            id="trackingNumber"
                            type="text"
                            value={trackingNumber}
                            onChange={(e) => setTrackingNumber(e.target.value)}
                            className="w-full px-4 py-3 border border-neutral-300 focus:outline-none focus:border-black"
                            placeholder="1Z999AA10123456784"
                        />
                    </div>

                    <div>
                        <label htmlFor="trackingUrl" className="block text-sm font-medium mb-2">
                            Tracking URL
                        </label>
                        <input
                            id="trackingUrl"
                            type="url"
                            value={trackingUrl}
                            onChange={(e) => setTrackingUrl(e.target.value)}
                            className="w-full px-4 py-3 border border-neutral-300 focus:outline-none focus:border-black"
                            placeholder="https://www.ups.com/track?..."
                        />
                    </div>
                </>
            )}

            <div className="flex gap-2">
                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 bg-black text-white py-3 font-medium hover:bg-neutral-800 disabled:opacity-50 transition-colors"
                >
                    {isSubmitting ? 'Updating...' : 'Update Order'}
                </button>

                {isEditing && (
                    <button
                        type="button"
                        onClick={() => {
                            setIsEditing(false)
                            setStatus(order.status)
                            setTrackingNumber(order.trackingNumber || '')
                            setTrackingUrl(order.trackingUrl || '')
                        }}
                        className="px-4 py-3 border border-neutral-300 hover:bg-neutral-100 transition-colors"
                    >
                        Cancel
                    </button>
                )}
            </div>
        </form>
        </>
    )
}
