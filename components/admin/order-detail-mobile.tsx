'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { formatPrice } from '@/lib/utils'
import { updateOrderStatus } from '@/app/admin/orders/actions'
import type { LiveOrderStatus } from '@/lib/orders/transition'
import type { Order, OrderItem } from '@prisma/client'
import { PaymentInfoModal } from '@/components/admin/payment-info-modal'
import { TrackingPrompt } from '@/components/admin/tracking-prompt'
import { CancelOrderPrompt } from '@/components/admin/cancel-order-prompt'

type OrderWithItems = Order & { items: OrderItem[] }

type ShippingAddress = {
    name: string
    address: string
    city: string
    state: string
    zip: string
    country: string
}

const fmtStatus = (s: string) => s.charAt(0) + s.slice(1).toLowerCase()

// Full-screen mobile order detail. Matches Figma node 1734:1963. The UI splits
// into two viewport-anchored groups: the top (header · items · total) hugs the
// top edge, the bottom (address · email · tracking · product shots · footer)
// hugs the bottom edge, with empty space between. Item prices sit one line
// below their qty line, pushed to the right edge.
export function OrderDetailMobile({
    order,
    shippingAddress,
    productImages,
}: {
    order: OrderWithItems
    shippingAddress: ShippingAddress
    productImages: Record<string, string>
}) {
    const [status, setStatus] = useState(order.status)
    const [showPayment, setShowPayment] = useState(false)
    // Set while the admin is being asked for tracking details before the order
    // flips to SHIPPED.
    const [pendingShip, setPendingShip] = useState(false)
    // Set while the admin is being asked what to do about the refund.
    const [pendingCancel, setPendingCancel] = useState(false)

    const orderNumber = order.orderNumber.startsWith('O-')
        ? order.orderNumber
        : `O-${order.orderNumber}`

    const created = new Date(order.createdAt)
    const fmtDate = created.toLocaleDateString('en-US', {
        month: 'numeric',
        day: 'numeric',
        year: 'numeric',
    })
    const fmtTime = created.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    })

    async function handleStatusChange(next: string) {
        // Shipping needs tracking details, so collect them before committing.
        if (next === 'SHIPPED') {
            setPendingShip(true)
            return
        }
        // Cancelling needs a refund decision.
        if (next === 'CANCELLED') {
            setPendingCancel(true)
            return
        }
        setStatus(next as typeof status)
        await updateOrderStatus(
            order.id,
            next as LiveOrderStatus,
            order.trackingNumber || undefined,
            order.trackingUrl || undefined,
        )
    }

    return (
        <div className="lg:hidden fixed inset-0 z-[100] bg-white flex flex-col justify-between text-[12px] font-bold text-black">
            {/* ── Top-anchored group ─────────────────────────────── */}
            <div>
                {/* Header — eye · Orders (left), order badge (center), status (right). */}
                <div className="relative flex items-start justify-between px-[11px] pt-[14px]">
                    <Link href="/admin/orders" className="flex items-center gap-[10px]">
                        <Image src="/eye.svg" alt="" width={20} height={10} />
                        <span className="opacity-40">—</span>
                        <span>Orders</span>
                    </Link>

                    <span className="absolute left-1/2 -translate-x-1/2 top-[15px] bg-[#e8e6e6] px-[8px] py-[1px]">
                        {orderNumber}
                    </span>

                    <div className="flex items-center gap-[8px]">
                        <span>Status:</span>
                        <div className="relative flex items-center">
                            <span>{fmtStatus(status)}</span>
                            <svg className="ml-[6px]" width="8" height="4" viewBox="0 0 8 4" fill="none" aria-hidden>
                                <path d="M0 0L4 4L8 0H0Z" fill="currentColor" />
                            </svg>
                            <select
                                value={status}
                                onChange={(e) => handleStatusChange(e.target.value)}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                aria-label="Order status"
                            >
                                <option value="PENDING">Pending</option>
                                <option value="PAID">Paid</option>
                                <option value="SHIPPED">Shipped</option>
                                <option value="CANCELLED">Cancelled</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Items — name / size / qty on the left, price one line below qty. */}
                <div className="px-[10px] pt-[128px] space-y-[28px]">
                    {order.items.map((item) => (
                        <div key={item.id} className="grid grid-cols-[1fr_auto] items-start">
                            <div className="space-y-[1px]">
                                <div className="truncate">{item.productName}</div>
                                <div>size: {item.size}</div>
                                <div>qty: {item.quantity}</div>
                            </div>
                            <div className="justify-self-end self-end translate-y-full">
                                {formatPrice(item.price * item.quantity)}
                            </div>
                        </div>
                    ))}

                    {/* Total — amount on the same line as the label. */}
                    <div className="grid grid-cols-[1fr_auto] items-start pt-[24px]">
                        <span>total</span>
                        <span className="justify-self-end">{formatPrice(order.total)}</span>
                    </div>
                </div>
            </div>

            {/* ── Bottom-anchored group ──────────────────────────── */}
            <div className="px-[10px] pb-[13px]">
                {/* Shipping address. */}
                <div className="space-y-[1px]">
                    <div>{shippingAddress.name}</div>
                    <div>{shippingAddress.address}</div>
                    <div>
                        {shippingAddress.city}, {shippingAddress.state} {shippingAddress.zip}
                    </div>
                    <div>{shippingAddress.country}</div>
                </div>

                {/* Email · Payment Info. */}
                <div className="flex items-center justify-between pt-[11px]">
                    <span>{order.email}</span>
                    <button
                        type="button"
                        onClick={() => setShowPayment(true)}
                        className="bg-[#e8e6e6] px-[8px] py-[1px]"
                    >
                        Payment Info
                    </button>
                </div>

                {/* Tracking — label left, number right. Editable once shipped. */}
                {status === 'SHIPPED' ? (
                    <button
                        type="button"
                        onClick={() => setPendingShip(true)}
                        className="w-full flex items-start justify-between pt-[27px] text-left"
                    >
                        <span>tracking:</span>
                        <span className="underline">
                            {order.trackingNumber || 'XXXXXNOTRACKINGYET'}
                        </span>
                    </button>
                ) : (
                    <div className="flex items-start justify-between pt-[27px]">
                        <span>tracking:</span>
                        <span>{order.trackingNumber || 'XXXXXNOTRACKINGYET'}</span>
                    </div>
                )}

                {/* Product shots — bottom-right. */}
                <div className="flex justify-end gap-[8px] pt-[17px] pr-[6px]">
                    {order.items.map((item) => {
                        const src = productImages[item.productId]
                        return src ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                key={item.id}
                                src={src}
                                alt={item.productName}
                                draggable={false}
                                className="h-[34px] w-[31px] object-contain opacity-90"
                            />
                        ) : null
                    })}
                </div>

                {/* Footer — order number (left) · date — time cluster starts at viewport center. */}
                <div className="grid grid-cols-2 items-center pt-[11px]">
                    <span>{orderNumber}</span>
                    <span className="flex items-center gap-[8px]">
                        <span>{fmtDate}</span>
                        <span className="h-px w-[42px] bg-black" />
                        <span>{fmtTime}</span>
                    </span>
                </div>
            </div>

            {showPayment && (
                <PaymentInfoModal orderId={order.id} onClose={() => setShowPayment(false)} />
            )}

            {pendingCancel && (
                <CancelOrderPrompt
                    orderId={order.id}
                    orderNumber={orderNumber}
                    onDone={() => {
                        setPendingCancel(false)
                        setStatus('CANCELLED')
                    }}
                    onCancel={() => setPendingCancel(false)}
                />
            )}

            {pendingShip && (
                <TrackingPrompt
                    orderId={order.id}
                    orderNumber={orderNumber}
                    trackingNumber={order.trackingNumber}
                    trackingUrl={order.trackingUrl}
                    alreadyShipped={status === 'SHIPPED'}
                    onDone={() => {
                        setPendingShip(false)
                        setStatus('SHIPPED')
                    }}
                    onCancel={() => setPendingShip(false)}
                />
            )}
        </div>
    )
}
