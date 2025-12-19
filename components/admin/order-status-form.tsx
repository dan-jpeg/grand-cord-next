'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateOrderStatus } from '@/app/admin/orders/actions'
import type { Order } from '@prisma/client'

export function OrderStatusForm({ order }: { order: Order }) {
    const router = useRouter()
    const [status, setStatus] = useState(order.status)
    const [trackingNumber, setTrackingNumber] = useState(order.trackingNumber || '')
    const [trackingUrl, setTrackingUrl] = useState(order.trackingUrl || '')
    const [isSubmitting, setIsSubmitting] = useState(false)

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setIsSubmitting(true)

        try {
            await updateOrderStatus(order.id, {
                status,
                trackingNumber: trackingNumber || null,
                trackingUrl: trackingUrl || null,
            })
            router.refresh()
        } catch (error) {
            alert('Failed to update order')
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label htmlFor="status" className="block text-sm font-medium mb-2">
                    Status
                </label>
                <select
                    id="status"
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full px-4 py-3 border border-neutral-300 focus:outline-none focus:border-black"
                >
                    <option value="PENDING">Pending</option>
                    <option value="PAID">Paid</option>
                    <option value="SHIPPED">Shipped</option>
                    <option value="CANCELLED">Cancelled</option>
                </select>
            </div>

            {(status === 'SHIPPED' || order.trackingNumber) && (
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

            <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-black text-white py-3 font-medium hover:bg-neutral-800 disabled:opacity-50 transition-colors"
            >
                {isSubmitting ? 'Updating...' : 'Update Order'}
            </button>
        </form>
    )
}