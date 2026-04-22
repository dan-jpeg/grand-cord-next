'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { markOrderShipped, partialRefundItem, cancelOrder } from '@/app/admin/pick/actions'

export type PickTask = {
    cartPhoto: string | null
    productName: string
    details: Array<{
        orderId: string
        orderLabel: string
        email: string
        size: string
        quantity: number
        price: number
    }>
}

export type ShipOrder = {
    id: string
    orderNumber: string
    recipientName: string
    address: string
    city: string
    state: string
    zip: string
    country: string
    email: string
    items: Array<{
        productName: string
        size: string
        quantity: number
        cartPhoto: string | null
    }>
}

type Phase = 'picking' | 'shipping'

export function PickRun({
    tasks,
    shipOrders: initialShipOrders,
}: {
    tasks: PickTask[]
    shipOrders: ShipOrder[]
}) {
    const router = useRouter()
    const [phase, setPhase] = useState<Phase>('picking')
    const [taskIndex, setTaskIndex] = useState(0)
    const [shipOrders, setShipOrders] = useState(initialShipOrders)
    const [shipIndex, setShipIndex] = useState(0)
    const [shipping, setShipping] = useState(false)

    function advanceTask() {
        if (taskIndex < tasks.length - 1) {
            setTaskIndex(i => i + 1)
        } else {
            if (shipOrders.length === 0) {
                router.push('/admin/orders')
            } else {
                setPhase('shipping')
            }
        }
    }

    function removeOrderFromShip(orderId: string) {
        setShipOrders(prev => prev.filter(o => o.id !== orderId))
    }

    if (phase === 'picking') {
        return (
            <PickItemView
                task={tasks[taskIndex]}
                taskIndex={taskIndex}
                taskTotal={tasks.length}
                onBack={() =>
                    taskIndex > 0
                        ? setTaskIndex(i => i - 1)
                        : router.push('/admin/pick')
                }
                onConfirm={advanceTask}
                onOrderCancelled={(orderId) => {
                    removeOrderFromShip(orderId)
                    advanceTask()
                }}
                onItemRefunded={advanceTask}
            />
        )
    }

    if (shipOrders.length === 0) {
        router.push('/admin/orders')
        return null
    }

    return (
        <ShipOrderView
            order={shipOrders[shipIndex]}
            shipIndex={shipIndex}
            shipTotal={shipOrders.length}
            shipping={shipping}
            onBack={() => {
                if (shipIndex > 0) {
                    setShipIndex(i => i - 1)
                } else {
                    setPhase('picking')
                    setTaskIndex(tasks.length - 1)
                }
            }}
            onShip={async () => {
                setShipping(true)
                await markOrderShipped(shipOrders[shipIndex].id)
                if (shipIndex < shipOrders.length - 1) {
                    setShipIndex(i => i + 1)
                    setShipping(false)
                } else {
                    router.push('/admin/orders')
                }
            }}
        />
    )
}

// ── Pick Item View ──────────────────────────────────────────────────────────

function PickItemView({
    task,
    taskIndex,
    taskTotal,
    onBack,
    onConfirm,
    onOrderCancelled,
    onItemRefunded,
}: {
    task: PickTask
    taskIndex: number
    taskTotal: number
    onBack: () => void
    onConfirm: () => void
    onOrderCancelled: (orderId: string) => void
    onItemRefunded: () => void
}) {
    const isLast = taskIndex === taskTotal - 1
    const [showUnavailable, setShowUnavailable] = useState(false)

    return (
        <div className="fixed inset-0 flex flex-col bg-[#e8e8e8]">
            {/* Top bar */}
            <div className="flex items-center justify-between px-5 pt-10 pb-4 flex-shrink-0">
                <button onClick={onBack} className="text-[11px] font-medium text-neutral-500">
                    ← back
                </button>
                <span className="text-[11px] font-medium text-neutral-500 tabular-nums">
                    {taskIndex + 1} / {taskTotal}
                </span>
            </div>

            {/* Cart photo */}
            <div className="flex-1 relative mx-5 rounded-2xl overflow-hidden">
                {task.cartPhoto ? (
                    <Image
                        src={task.cartPhoto}
                        alt={task.productName}
                        fill
                        className="object-contain"
                        sizes="(max-width: 768px) 100vw, 320px"
                        priority
                    />
                ) : (
                    <div className="absolute inset-0" />
                )}
            </div>

            {/* Product info */}
            <div className="px-5 pt-5 pb-2 flex-shrink-0">
                <p className="text-[20px] font-semibold tracking-tight leading-snug mb-3">
                    {task.productName}
                </p>
                <div className="flex flex-col gap-[5px]">
                    {task.details.map((d, i) => (
                        <div key={i} className="flex items-center gap-2">
                            <span className="text-[10px] font-medium bg-white rounded-[6px] px-2 py-[3px] text-neutral-700 tabular-nums">
                                {d.orderLabel}
                            </span>
                            <span className="text-[11px] text-neutral-500">
                                {d.size} · Qty {d.quantity}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Item unavailable trigger */}
            <div className="px-5 pb-3 flex-shrink-0">
                <button
                    onClick={() => setShowUnavailable(true)}
                    className="text-[10px] text-neutral-400 font-medium"
                >
                    Item unavailable?
                </button>
            </div>

            {/* CTA */}
            <div className="flex-shrink-0 bg-white">
                <button
                    onClick={onConfirm}
                    className="w-full text-center text-[26px] font-semibold tracking-tight py-7"
                >
                    {isLast ? 'Done Picking' : 'Confirm Pick'}
                </button>
            </div>

            {/* Unavailable sheet */}
            {showUnavailable && (
                <ItemUnavailableSheet
                    task={task}
                    onClose={() => setShowUnavailable(false)}
                    onOrderCancelled={(orderId) => {
                        setShowUnavailable(false)
                        onOrderCancelled(orderId)
                    }}
                    onItemRefunded={() => {
                        setShowUnavailable(false)
                        onItemRefunded()
                    }}
                />
            )}
        </div>
    )
}

// ── Item Unavailable Sheet ──────────────────────────────────────────────────

function ItemUnavailableSheet({
    task,
    onClose,
    onOrderCancelled,
    onItemRefunded,
}: {
    task: PickTask
    onClose: () => void
    onOrderCancelled: (orderId: string) => void
    onItemRefunded: () => void
}) {
    const [loading, setLoading] = useState<string | null>(null)

    const primaryDetail = task.details[0]

    // mailto with pre-filled subject + body
    const emailBody = encodeURIComponent(
        `Hi,\n\nWe're sorry, but we were unable to fulfill the following item from your order:\n\n` +
        `${task.productName} — Size ${primaryDetail.size} × ${primaryDetail.quantity}\n\n` +
        `We'll be in touch shortly regarding your options.\n\nThank you for your patience.`
    )
    const emailSubject = encodeURIComponent(`Update on your order #${primaryDetail.orderLabel}`)
    const mailtoHref = `mailto:${primaryDetail.email}?subject=${emailSubject}&body=${emailBody}`

    async function handlePartialRefund() {
        setLoading('refund')
        try {
            await Promise.all(
                task.details.map(d =>
                    partialRefundItem(d.orderId, Math.round(d.price * d.quantity * 100))
                )
            )
            onItemRefunded()
        } finally {
            setLoading(null)
        }
    }

    async function handleCancelOrder() {
        setLoading('cancel')
        try {
            // For batch tasks with multiple orders, cancel each one
            await Promise.all(task.details.map(d => cancelOrder(d.orderId)))
            // Report the first orderId (PickRun will remove all affected)
            onOrderCancelled(primaryDetail.orderId)
        } finally {
            setLoading(null)
        }
    }

    return (
        <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/20"
            onClick={onClose}
        >
            <div
                className="w-full max-w-sm bg-white rounded-t-[2rem] px-6 pt-6 pb-12"
                onClick={e => e.stopPropagation()}
            >
                <p className="text-[11px] font-semibold tracking-[0.12em] text-neutral-400 mb-1 text-center">
                    ITEM UNAVAILABLE
                </p>
                <p className="text-[12px] text-neutral-500 text-center mb-6">
                    {task.productName}
                </p>

                <div className="flex flex-col gap-3">
                    {/* Email customer */}
                    <a
                        href={mailtoHref}
                        className="w-full py-4 rounded-2xl bg-neutral-100 text-neutral-900 text-[14px] font-semibold text-center block"
                        onClick={onClose}
                    >
                        Email Customer
                        <span className="block text-[11px] font-normal text-neutral-500 mt-0.5">
                            {primaryDetail.email}
                        </span>
                    </a>

                    {/* Partial refund */}
                    <button
                        onClick={handlePartialRefund}
                        disabled={!!loading}
                        className="w-full py-4 rounded-2xl bg-neutral-100 text-neutral-900 text-[14px] font-semibold disabled:opacity-50 transition-opacity"
                    >
                        {loading === 'refund' ? 'Refunding...' : 'Partial Refund'}
                        <span className="block text-[11px] font-normal text-neutral-500 mt-0.5">
                            Refund this item, continue with order
                        </span>
                    </button>

                    {/* Cancel order */}
                    <button
                        onClick={handleCancelOrder}
                        disabled={!!loading}
                        className="w-full py-4 rounded-2xl bg-red-50 text-red-600 text-[14px] font-semibold disabled:opacity-50 transition-opacity"
                    >
                        {loading === 'cancel' ? 'Cancelling...' : 'Cancel Order'}
                        <span className="block text-[11px] font-normal text-red-400 mt-0.5">
                            Full refund, remove from queue
                        </span>
                    </button>
                </div>
            </div>
        </div>
    )
}

// ── Ship Order View ─────────────────────────────────────────────────────────

function ShipOrderView({
    order,
    shipIndex,
    shipTotal,
    shipping,
    onBack,
    onShip,
}: {
    order: ShipOrder
    shipIndex: number
    shipTotal: number
    shipping: boolean
    onBack: () => void
    onShip: () => void
}) {
    const isLast = shipIndex === shipTotal - 1

    return (
        <div className="fixed inset-0 flex flex-col bg-[#e8e8e8]">
            {/* Top bar */}
            <div className="flex items-center justify-between px-5 pt-10 pb-4 flex-shrink-0">
                <button onClick={onBack} className="text-[11px] font-medium text-neutral-500">
                    ← back
                </button>
                {shipTotal > 1 && (
                    <span className="text-[11px] font-medium text-neutral-500 tabular-nums">
                        {shipIndex + 1} / {shipTotal}
                    </span>
                )}
            </div>

            {/* Order label */}
            <div className="px-5 pb-5 flex-shrink-0">
                <p className="text-[26px] font-semibold tracking-tight leading-none">
                    {order.orderNumber.slice(0, 3)}
                </p>
                <p className="text-[11px] text-neutral-500 mt-1">Ready to ship</p>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto px-5 flex flex-col gap-3">
                {/* Item photo strip */}
                {order.items.length > 0 && (
                    <div className="flex gap-2">
                        {order.items.map((item, i) => (
                            <div key={i} className="flex flex-col items-center gap-1">
                                <div
                                    className="relative rounded-[6px] overflow-hidden flex-shrink-0"
                                    style={{ width: 44, height: 64 }}
                                >
                                    {item.cartPhoto ? (
                                        <Image
                                            src={item.cartPhoto}
                                            alt={item.productName}
                                            fill
                                            className="object-cover"
                                            sizes="44px"
                                        />
                                    ) : (
                                        <div className="absolute inset-0 bg-neutral-200" />
                                    )}
                                </div>
                                <span className="text-[8px] text-neutral-400 font-medium">
                                    {item.size}
                                </span>
                            </div>
                        ))}
                    </div>
                )}

                {/* Address card */}
                <div className="bg-white rounded-[10px] px-4 py-4">
                    <p className="text-[9px] font-semibold tracking-[0.12em] text-neutral-400 mb-3">
                        SHIP TO
                    </p>
                    <p className="text-[14px] font-semibold text-neutral-800 leading-snug">
                        {order.recipientName}
                    </p>
                    <p className="text-[12px] text-neutral-500 mt-1 leading-relaxed whitespace-pre-line">
                        {order.address}{'\n'}{order.city}, {order.state} {order.zip}{'\n'}{order.country}
                    </p>
                    <p className="text-[11px] text-neutral-400 mt-3">{order.email}</p>
                </div>
            </div>

            {/* CTA */}
            <div className="flex-shrink-0 bg-white">
                <button
                    onClick={onShip}
                    disabled={shipping}
                    className="w-full text-center text-[26px] font-semibold tracking-tight py-7 disabled:text-neutral-300 transition-colors"
                >
                    {shipping ? '...' : isLast ? 'All Shipped' : 'Mark Shipped'}
                </button>
            </div>
        </div>
    )
}
