'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { formatPrice } from '@/lib/utils'
import { updateOrderStatus } from '@/app/admin/orders/actions'
import type { Order, OrderItem } from '@prisma/client'

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

// Full-screen mobile order detail. Matches Figma node 1720:3251 — 12px bold
// Alte Haas type, product shots up top, item lines, status, address/email and
// a bottom-anchored order-number / date / time bar.
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

    // Tap an item line to spotlight it: the tapped line + its photo go to 95%
    // opacity, everything else dims to 20%. Tapping again (or 10s of inactivity)
    // returns to normal.
    const [selectedId, setSelectedId] = useState<string | null>(null)
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])

    const clearTimer = () => {
        if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null }
    }

    const toggleItem = (id: string) => {
        clearTimer()
        if (selectedId === id) {
            setSelectedId(null)
            return
        }
        setSelectedId(id)
        timerRef.current = setTimeout(() => setSelectedId(null), 10000)
    }

    // Tapping anywhere outside an item line/photo clears the spotlight.
    const resetSelection = () => {
        clearTimer()
        setSelectedId(null)
    }

    // Opacity for an element tied to a specific item (line or photo).
    const itemOpacity = (id: string, base = '') =>
        selectedId ? (id === selectedId ? 'opacity-95' : 'opacity-20') : base
    // Opacity for everything not tied to the selected item.
    const restOpacity = selectedId ? 'opacity-20' : ''

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
        setStatus(next as typeof status)
        await updateOrderStatus(
            order.id,
            next as 'PENDING' | 'PAID' | 'SHIPPED' | 'CANCELLED',
            order.trackingNumber || undefined,
            order.trackingUrl || undefined,
        )
    }

    return (
        <div onClick={resetSelection} className="lg:hidden fixed inset-0 z-[100] bg-white flex flex-col text-[12px] font-bold text-black">
            {/* Header — eye · Orders back link, order number badge. */}
            <div className="flex items-center justify-between px-[16px] pt-[12px]">
                <Link href="/admin/orders" className="flex items-center gap-[10px]">
                    <Image src="/eye.svg" alt="" width={20} height={10} />
                    <span className="opacity-40">—</span>
                    <span>Orders</span>
                </Link>
                <span className={`bg-[#e8e6e6] px-[8px] py-[1px] transition-opacity duration-150 ${restOpacity}`}>{orderNumber}</span>
            </div>

            <div className="flex-1 overflow-y-auto">
                {/* Product shots. */}
                <div className="flex justify-center gap-[10px] pt-[40px]">
                    {order.items.map((item) => {
                        const src = productImages[item.productId]
                        return src ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                key={item.id}
                                src={src}
                                alt={item.productName}
                                draggable={false}
                                onClick={(e) => { e.stopPropagation(); toggleItem(item.id) }}
                                className={`h-[36px] w-[32px] object-contain cursor-pointer transition-opacity duration-150 ${itemOpacity(item.id, 'opacity-90')}`}
                            />
                        ) : null
                    })}
                </div>

                {/* Item lines. */}
                <div className="px-[16px] pt-[50px] space-y-[10px]">
                    {order.items.map((item) => (
                        <div
                            key={item.id}
                            onClick={(e) => { e.stopPropagation(); toggleItem(item.id) }}
                            className={`grid grid-cols-[minmax(0,1fr)_auto_auto_auto] items-center gap-x-[12px] cursor-pointer transition-opacity duration-150 ${itemOpacity(item.id)}`}
                        >
                            <span className="truncate">{item.productName}</span>
                            <span>size: {item.size}</span>
                            <span>qty: {item.quantity}</span>
                            <span className="flex items-center gap-[8px] justify-end">
                                <span className="h-px w-[42px] bg-black" />
                                <span className="w-[36px] text-right">
                                    {formatPrice(item.price * item.quantity)}
                                </span>
                            </span>
                        </div>
                    ))}

                    {/* Total. */}
                    <div className={`grid grid-cols-[minmax(0,1fr)_auto_auto_auto] items-center gap-x-[12px] pt-[16px] transition-opacity duration-150 ${restOpacity}`}>
                        <span />
                        <span />
                        <span className="justify-self-end pr-[4px]">total</span>
                        <span className="flex items-center gap-[8px] justify-end">
                            <span className="h-px w-[42px] bg-black" />
                            <span className="w-[36px] text-right">{formatPrice(order.total)}</span>
                        </span>
                    </div>
                </div>

                {/* Status. */}
                <div className={`flex items-center justify-between px-[21px] pt-[150px] transition-opacity duration-150 ${restOpacity}`}>
                    <span>Status:</span>
                    <div className="relative flex items-center">
                        <span>{fmtStatus(status)}</span>
                        <svg
                            className="ml-[6px]"
                            width="8"
                            height="4"
                            viewBox="0 0 8 4"
                            fill="none"
                            aria-hidden
                        >
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

                {/* Address + email. */}
                <div className={`flex justify-between px-[21px] pt-[120px] transition-opacity duration-150 ${restOpacity}`}>
                    <div className="space-y-[7px]">
                        <div>{shippingAddress.name}</div>
                        <div>{shippingAddress.address}</div>
                        <div>
                            {shippingAddress.city}, {shippingAddress.state} {shippingAddress.zip}
                        </div>
                        <div>{shippingAddress.country}</div>
                    </div>
                    <div>{order.email}</div>
                </div>
            </div>

            {/* Bottom bar — order number · date · time. */}
            <div className={`shrink-0 grid grid-cols-3 items-center px-[23px] pb-[18px] pt-[10px] transition-opacity duration-150 ${restOpacity}`}>
                <span>{orderNumber}</span>
                <span className="text-center">{fmtDate}</span>
                <span className="flex items-center justify-end gap-[8px]">
                    <span className="h-px w-[42px] bg-black" />
                    {fmtTime}
                </span>
            </div>
        </div>
    )
}
