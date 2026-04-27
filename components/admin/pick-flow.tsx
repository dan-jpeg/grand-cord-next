'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { motion, AnimatePresence, LayoutGroup, useMotionValue, useTransform, animate } from 'framer-motion'
import { markOrderShipped, partialRefundItem, cancelOrder, quoteShippoLabel, purchaseShippoLabel } from '@/app/admin/pick/actions'
import type { ShippoQuote } from '@/lib/shippo'

// ── Constants ────────────────────────────────────────────────────────────────

const FALLBACK_PICK_COLORS: Record<string, string> = {
    black: '#1a1a1a',
    white: '#f5f5f0',
    navy: '#334667',
    olive: '#5c5c3d',
    grey: '#888888',
    gray: '#888888',
    brown: '#6b4a2a',
    red: '#c0392b',
    green: '#2d6a4f',
    blue: '#2c5282',
}
const FALLBACK_PICK_COLOR = '#334667'

function pickColor(colorHex: string | null, colorName: string | null): string {
    if (colorHex) return colorHex
    if (colorName) {
        const key = colorName.toLowerCase().trim()
        for (const [k, v] of Object.entries(FALLBACK_PICK_COLORS)) {
            if (key.includes(k)) return v
        }
    }
    return FALLBACK_PICK_COLOR
}

// ── Types ────────────────────────────────────────────────────────────────────

export type FlowOrderItem = {
    productId: string
    productName: string
    size: string
    quantity: number
    price: number
    cartPhoto: string | null
    color: string | null
    colorHex: string | null
}

export type FlowOrder = {
    id: string
    orderNumber: string
    createdAt: Date
    email: string
    shippingAddress: Record<string, string>
    items: FlowOrderItem[]
}

type PickTask = {
    productId: string
    cartPhoto: string | null
    productName: string
    color: string | null
    colorHex: string | null
    details: Array<{
        orderId: string
        orderLabel: string
        createdAt: Date
        email: string
        size: string
        quantity: number
        price: number
    }>
}

type ShipOrder = {
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
        productId: string
        productName: string
        size: string
        quantity: number
        cartPhoto: string | null
    }>
}

type Phase = 'queue' | 'calculating' | 'picking' | 'shipping'

type CalcSummary = { itemCount: number; taskCount: number; orderCount: number }
type TaskStatus = 'picked' | 'missing'

// ── Helpers ──────────────────────────────────────────────────────────────────

function urgencyColor(createdAt: Date): string {
    const days = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24)
    if (days > 7) return '#ef4444'
    if (days >= 3) return '#eab308'
    return '#3b82f6'
}

function mostUrgentColor(orders: FlowOrder[]): string {
    const colors = orders.map(o => urgencyColor(o.createdAt))
    if (colors.includes('#ef4444')) return '#ef4444'
    if (colors.includes('#eab308')) return '#eab308'
    return '#3b82f6'
}

function buildTasks(orders: FlowOrder[], mode: 'batch' | 'sequential'): PickTask[] {
    if (mode === 'batch') {
        const grouped = new Map<string, PickTask>()
        for (const order of orders) {
            for (const item of order.items) {
                const existing = grouped.get(item.productId)
                const detail = {
                    orderId: order.id,
                    orderLabel: order.orderNumber.slice(-3),
                    createdAt: order.createdAt,
                    email: order.email,
                    size: item.size,
                    quantity: item.quantity,
                    price: item.price,
                }
                if (existing) {
                    existing.details.push(detail)
                } else {
                    grouped.set(item.productId, {
                        productId: item.productId,
                        cartPhoto: item.cartPhoto,
                        productName: item.productName,
                        color: item.color,
                        colorHex: item.colorHex,
                        details: [detail],
                    })
                }
            }
        }
        return [...grouped.values()]
    }
    return orders.flatMap(order =>
        order.items.map(item => ({
            productId: item.productId,
            cartPhoto: item.cartPhoto,
            productName: item.productName,
            color: item.color,
            colorHex: item.colorHex,
            details: [{
                orderId: order.id,
                orderLabel: order.orderNumber.slice(-3),
                createdAt: order.createdAt,
                email: order.email,
                size: item.size,
                quantity: item.quantity,
                price: item.price,
            }],
        }))
    )
}

function buildShipOrders(orders: FlowOrder[]): ShipOrder[] {
    return orders.map(order => {
        const addr = order.shippingAddress
        return {
            id: order.id,
            orderNumber: order.orderNumber,
            recipientName: addr.name ?? '',
            address: addr.address ?? '',
            city: addr.city ?? '',
            state: addr.state ?? '',
            zip: addr.zip ?? '',
            country: addr.country ?? '',
            email: order.email,
            items: order.items.map(item => ({
                productId: item.productId,
                productName: item.productName,
                size: item.size,
                quantity: item.quantity,
                cartPhoto: item.cartPhoto,
            })),
        }
    })
}

const spring = { type: 'spring', stiffness: 380, damping: 30 } as const

function OrderBadge({
    label,
    createdAt,
    done = false,
}: {
    label: string
    createdAt: Date
    done?: boolean
}) {
    return (
        <div className="flex items-center gap-[5px] bg-white px-[10px] py-[7px] flex-shrink-0">
            {done ? (
                <svg width="8" height="8" viewBox="0 0 8 8" fill="none" className="flex-shrink-0">
                    <polyline points="1,4.5 3,6.5 7,2" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            ) : (
                <span
                    className="rounded-full flex-shrink-0"
                    style={{ display: 'inline-block', width: 8, height: 8, backgroundColor: urgencyColor(createdAt) }}
                />
            )}
            <span className="text-[8px] font-bold tracking-[0.09em] uppercase">
                O-{label}
            </span>
        </div>
    )
}

// ── Root ─────────────────────────────────────────────────────────────────────

export function PickFlow({ orders }: { orders: FlowOrder[] }) {
    const router = useRouter()
    const [phase, setPhase] = useState<Phase>('queue')
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(orders.map(o => o.id)))
    const [showModeModal, setShowModeModal] = useState(false)
    const [tasks, setTasks] = useState<PickTask[]>([])
    const [taskIndex, setTaskIndex] = useState(0)
    const [taskStatuses, setTaskStatuses] = useState<Record<number, TaskStatus>>({})
    const [shipOrders, setShipOrders] = useState<ShipOrder[]>([])
    const [shipIndex, setShipIndex] = useState(0)
    const [calcSummary, setCalcSummary] = useState<CalcSummary | null>(null)

    const dragX = useMotionValue(0)
    const dragRotate = useTransform(dragX, [-200, 200], [-3, 3])
    const swipeNextOpacity = useTransform(dragX, [-120, -30], [1, 0])
    const swipePrevOpacity = useTransform(dragX, [30, 120], [0, 1])

    useEffect(() => { dragX.set(0) }, [taskIndex, dragX])

    const allSelected = selectedIds.size === orders.length
    const noneSelected = selectedIds.size === 0

    function toggleOrder(id: string) {
        setSelectedIds(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    function beginRun(mode: 'batch' | 'sequential') {
        const selected = orders.filter(o => selectedIds.has(o.id))
        const builtTasks = buildTasks(selected, mode)
        const builtShip = buildShipOrders(selected)
        const itemCount = selected.flatMap(o => o.items).reduce((s, i) => s + i.quantity, 0)
        setTasks(builtTasks)
        setShipOrders(builtShip)
        setTaskIndex(0)
        setTaskStatuses({})
        setShipIndex(0)
        setShowModeModal(false)
        setCalcSummary({ itemCount, taskCount: builtTasks.length, orderCount: selected.length })
        setPhase('calculating')
    }

    function markTask(index: number, status: TaskStatus) {
        setTaskStatuses(prev => ({ ...prev, [index]: status }))
    }

    function advanceTask(removedOrderId?: string, justMarkedStatus?: TaskStatus) {
        if (removedOrderId) {
            setShipOrders(prev => prev.filter(o => o.id !== removedOrderId))
        }
        const resolvedIndices = new Set<number>()
        for (const k of Object.keys(taskStatuses)) resolvedIndices.add(Number(k))
        if (justMarkedStatus) resolvedIndices.add(taskIndex)

        const nextUnresolved = tasks.findIndex((_, i) => i !== taskIndex && !resolvedIndices.has(i))
        if (nextUnresolved !== -1) {
            // Prefer moving forward; otherwise jump back to the earliest unresolved
            const forward = tasks.findIndex((_, i) => i > taskIndex && !resolvedIndices.has(i))
            setTaskIndex(forward !== -1 ? forward : nextUnresolved)
            return
        }

        // All tasks resolved → move to shipping (or finish if nothing left)
        const remaining = removedOrderId
            ? shipOrders.filter(o => o.id !== removedOrderId)
            : shipOrders
        if (remaining.length === 0) {
            router.push('/admin/orders')
        } else {
            setPhase('shipping')
        }
    }

    const batchDotColor = mostUrgentColor(orders)

    return (
        <LayoutGroup>
            <GrainOverlay />
            {/* Single AnimatePresence so Framer tracks layoutId positions across phase transitions */}
            <AnimatePresence>

            {/* ── Queue ── */}
            {phase === 'queue' && (
                    <motion.div
                        key="queue"
                        className="fixed inset-0 flex flex-col bg-[#e8e8e8] md:items-center"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.18 }}
                    >
                        <div className="flex flex-col bg-[#e8e8e8] w-full h-full md:max-w-screen-sm md:border md:border-black">
                            <div className="flex-1 overflow-y-auto">
                                <div className="flex items-start justify-center pt-12 pb-10 gap-[4px]">
                                    <span className="font-alte text-[36px] tracking-[-0.03em] leading-none">Pick Queue</span>
                                    <span
                                        className="flex-shrink-0 rounded-full bg-black flex items-center justify-center text-white font-bold leading-none select-none"
                                        style={{ width: 10, height: 10, fontSize: 7, marginTop: 3 }}
                                    >
                                        i
                                    </span>
                                </div>

                                <div className="flex items-center justify-center gap-[7px] pb-8">
                                    <span
                                        className="rounded-full flex-shrink-0"
                                        style={{ display: 'inline-block', width: 8, height: 8, backgroundColor: batchDotColor }}
                                    />
                                    <span className="text-[11px] font-bold tracking-[0.09em] opacity-70">
                                        {orders.length} Orders to Ship
                                    </span>
                                </div>

                                <div className="flex flex-col gap-[18px] px-5">
                                    {orders.map(order => {
                                        const isSelected = selectedIds.has(order.id)
                                        const itemCount = order.items.reduce((s, i) => s + i.quantity, 0)
                                        return (
                                            <button
                                                key={order.id}
                                                onClick={() => toggleOrder(order.id)}
                                                className="flex items-center w-full text-left transition-opacity duration-150"
                                                style={{ opacity: isSelected ? 1 : 0.28 }}
                                            >
                                                <OrderBadge label={order.orderNumber.slice(-3)} createdAt={order.createdAt} />

                                                <div className="flex-1" />

                                                <div className="flex items-end gap-[10px] flex-shrink-0">
                                                    <div className="flex items-end gap-[3px]">
                                                        {order.items.length === 0
                                                            ? <div className="w-[20px] h-[30px]" />
                                                            : order.items.slice(0, 4).map((item, idx) =>
                                                                item.cartPhoto ? (
                                                                    <div
                                                                        key={idx}
                                                                        className="flex-shrink-0"
                                                                        style={{ height: 36 }}
                                                                    >
                                                                        <Image
                                                                            src={item.cartPhoto}
                                                                            alt=""
                                                                            width={40}
                                                                            height={36}
                                                                            className="h-full w-auto object-contain"
                                                                            sizes="40px"
                                                                        />
                                                                    </div>
                                                                ) : (
                                                                    <div key={idx} className="w-[20px] h-[30px]" />
                                                                )
                                                            )
                                                        }
                                                    </div>
                                                    <span className="text-[8px] font-bold tracking-[0.09em] uppercase pb-[2px]">
                                                        {itemCount} ITEM{itemCount !== 1 ? 'S' : ''}
                                                    </span>
                                                </div>
                                            </button>
                                        )
                                    })}
                                </div>

                                <div className="flex justify-end px-5 pt-6">
                                    <span className="font-reformat text-[10px] tracking-[0.12em] bg-white px-[10px] py-[7px]">
                                        {selectedIds.size} / {orders.length} selected
                                    </span>
                                </div>

                                <div className="flex flex-col gap-[10px] px-5 pt-5">
                                    <button
                                        onClick={() => setSelectedIds(new Set())}
                                        disabled={noneSelected}
                                        className="text-left font-reformat text-[10px] tracking-[0.12em] uppercase disabled:opacity-30 transition-opacity w-fit"
                                    >
                                        Unselect All
                                    </button>
                                    <button
                                        onClick={() => setSelectedIds(new Set(orders.map(o => o.id)))}
                                        disabled={allSelected}
                                        className="text-left font-reformat text-[10px] tracking-[0.12em] uppercase disabled:opacity-30 transition-opacity w-fit"
                                    >
                                        Select All
                                    </button>
                                </div>
                            </div>

                            <div className="flex-shrink-0 bg-white">
                                <button
                                    onClick={() => !noneSelected && setShowModeModal(true)}
                                    disabled={noneSelected}
                                    className="w-full text-center font-alte font-bold text-[36px] tracking-[-0.03em] py-7 transition-colors"
                                    style={{ color: noneSelected ? '#c0c0c0' : '#1a1a1a' }}
                                >
                                    Begin
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}

            {/* ── Calculating ── */}
            {phase === 'calculating' && calcSummary && (
                <motion.div
                    key="calculating"
                    className="fixed inset-0 flex flex-col bg-[#f2f2f2] items-center justify-center px-8"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.18 }}
                >
                    <CalculatingBody
                        summary={calcSummary}
                        onContinue={() => setPhase('picking')}
                    />
                </motion.div>
            )}

            {/* ── Picking ── */}
            {phase === 'picking' && tasks.length > 0 && (() => {
                const current = tasks[taskIndex]
                const totalQty = current.details.reduce((s, d) => s + d.quantity, 0)
                const primaryDetail = current.details[0]
                // An order is fully resolved only when every task containing it has a status.
                const orderIsFullyResolved = (orderId: string): boolean => {
                    for (let i = 0; i < tasks.length; i++) {
                        const containsOrder = tasks[i].details.some(d => d.orderId === orderId)
                        if (containsOrder && !taskStatuses[i]) return false
                    }
                    return true
                }
                // Past: unique orders from already-completed tasks
                const pastPills: Array<{ orderId: string; label: string; createdAt: Date; done: boolean }> = []
                const seenOrders = new Set<string>()
                for (let i = 0; i < taskIndex; i++) {
                    for (const d of tasks[i].details) {
                        if (!seenOrders.has(d.orderId)) {
                            seenOrders.add(d.orderId)
                            pastPills.push({ orderId: d.orderId, label: d.orderLabel, createdAt: d.createdAt, done: orderIsFullyResolved(d.orderId) })
                        }
                    }
                }
                // Current (dedupe against past, mark as seen so upcoming dedupes)
                const currentPills: Array<{ orderId: string; label: string; createdAt: Date }> = []
                for (const d of current.details) {
                    if (!seenOrders.has(d.orderId)) {
                        seenOrders.add(d.orderId)
                        currentPills.push({ orderId: d.orderId, label: d.orderLabel, createdAt: d.createdAt })
                    }
                }
                // Upcoming: next unique orders
                const upcomingPills: Array<{ orderId: string; label: string; createdAt: Date }> = []
                for (let i = taskIndex + 1; i < tasks.length && upcomingPills.length < 4; i++) {
                    for (const d of tasks[i].details) {
                        if (!seenOrders.has(d.orderId) && upcomingPills.length < 4) {
                            seenOrders.add(d.orderId)
                            upcomingPills.push({ orderId: d.orderId, label: d.orderLabel, createdAt: d.createdAt })
                        }
                    }
                }

                return (
                    <motion.div
                        key="picking"
                        className="fixed inset-0 flex flex-col bg-[#f2f2f2]"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.18 }}
                    >
                        {/* White header slab */}
                        <div className="flex-shrink-0 bg-white pt-8 pb-5 px-5 relative">
                            <button
                                onClick={() => taskIndex > 0 ? setTaskIndex(i => i - 1) : setPhase('queue')}
                                className="absolute right-5 top-8 text-[11px] font-medium text-neutral-400"
                            >
                                ← back
                            </button>
                            <p className="font-alte text-[53px] leading-none tracking-[-0.03em] text-black mb-4">
                                Picking
                            </p>
                            <div className="flex gap-[6px] overflow-x-auto [&::-webkit-scrollbar]:hidden">
                                <AnimatePresence>
                                    {pastPills.map((p) => (
                                        <motion.div
                                            key={p.orderId}
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 0.45 }}
                                            exit={{ opacity: 0 }}
                                            transition={{ duration: 0.2 }}
                                        >
                                            <OrderBadge label={p.label} createdAt={p.createdAt} done={p.done} />
                                        </motion.div>
                                    ))}
                                    {currentPills.map((p) => (
                                        <motion.div
                                            key={p.orderId}
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                            transition={{ duration: 0.2 }}
                                        >
                                            <OrderBadge label={p.label} createdAt={p.createdAt} />
                                        </motion.div>
                                    ))}
                                    {upcomingPills.map((p) => (
                                        <motion.div
                                            key={p.orderId}
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 0.2 }}
                                            exit={{ opacity: 0 }}
                                            transition={{ duration: 0.2 }}
                                        >
                                            <OrderBadge label={p.label} createdAt={p.createdAt} />
                                        </motion.div>
                                    ))}
                                </AnimatePresence>
                            </div>
                        </div>

                        <ProgressStrip
                            tasks={tasks}
                            taskIndex={taskIndex}
                            taskStatuses={taskStatuses}
                            onJump={(i) => setTaskIndex(i)}
                        />

                        {/* Name badge + quantity */}
                        <div className="px-5 pb-3 flex-shrink-0 flex items-center gap-4">
                            <div className="bg-white px-[10px] py-[5px] max-w-[70%] overflow-hidden relative">
                                <AnimatePresence mode="wait">
                                    <motion.span
                                        key={current.productName}
                                        className="font-alte font-bold text-[22px] tracking-[-0.01em] leading-none block truncate"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        transition={{ duration: 0.2 }}
                                    >
                                        {current.productName}
                                    </motion.span>
                                </AnimatePresence>
                            </div>
                            <div className="overflow-hidden">
                                <AnimatePresence mode="wait">
                                    <motion.span
                                        key={totalQty}
                                        className="font-alte text-[22px] leading-none block"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        transition={{ duration: 0.2 }}
                                    >
                                        x{totalQty}
                                    </motion.span>
                                </AnimatePresence>
                            </div>
                        </div>

                        {/* Swipe-to-navigate image area */}
                        <motion.div
                            className="flex-1 mx-5 relative"
                            drag="x"
                            dragConstraints={{ left: -140, right: 140 }}
                            dragElastic={0.25}
                            style={{ x: dragX, rotate: dragRotate }}
                            onDragEnd={(_, info) => {
                                const snap = { type: 'spring', stiffness: 400, damping: 30 } as const
                                const swipedLeft = info.offset.x < -80 || info.velocity.x < -400
                                const swipedRight = info.offset.x > 80 || info.velocity.x > 400
                                if (swipedLeft) {
                                    let target: number | null = null
                                    if (taskIndex < tasks.length - 1) {
                                        target = taskIndex + 1
                                    } else {
                                        const firstUnresolved = tasks.findIndex((_, i) => !taskStatuses[i])
                                        if (firstUnresolved !== -1 && firstUnresolved !== taskIndex) target = firstUnresolved
                                    }
                                    if (target !== null) {
                                        const next = target
                                        animate(dragX, -300, { duration: 0.2, ease: 'easeIn' }).then(() => {
                                            dragX.set(0)
                                            setTaskIndex(next)
                                        })
                                    } else {
                                        animate(dragX, 0, { type: 'spring', stiffness: 400, damping: 30 })
                                    }
                                } else if (swipedRight && taskIndex > 0) {
                                    animate(dragX, 300, { duration: 0.2, ease: 'easeIn' }).then(() => {
                                        dragX.set(0)
                                        setTaskIndex(i => i - 1)
                                    })
                                } else {
                                    animate(dragX, 0, snap)
                                }
                            }}
                        >
                            <AnimatePresence>
                                <motion.div
                                    key={taskIndex}
                                    className="absolute inset-0"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 0.15 }}
                                >
                                    {/* Float animation decoupled from enter/exit */}
                                    <motion.div
                                        className="absolute inset-0"
                                        animate={{ y: [0, -14, 0], scale: [1, 1.025, 1] }}
                                        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: 0.15 }}
                                    >
                                        {current.cartPhoto ? (
                                            <Image
                                                src={current.cartPhoto}
                                                alt={current.productName}
                                                fill
                                                className="object-contain"
                                                sizes="(max-width: 768px) 100vw, 320px"
                                                priority
                                            />
                                        ) : (
                                            <div className="absolute inset-0" />
                                        )}
                                    </motion.div>
                                </motion.div>
                            </AnimatePresence>

                            {/* Swipe-right → next */}
                            <motion.div
                                style={{ opacity: swipeNextOpacity }}
                                className="absolute inset-0 pointer-events-none flex items-center justify-end pr-6"
                            >
                                <span className="text-black/30 font-bold text-[28px]">›</span>
                            </motion.div>
                            {/* Swipe-left → prev */}
                            <motion.div
                                style={{ opacity: swipePrevOpacity }}
                                className="absolute inset-0 pointer-events-none flex items-center justify-start pl-6"
                            >
                                <span className="text-black/30 font-bold text-[28px]">‹</span>
                            </motion.div>
                        </motion.div>

                        {/* Color swatch + size */}
                        <div className="flex items-center justify-between px-5 pt-6 pb-4 flex-shrink-0">
                            <div className="overflow-hidden">
                                <AnimatePresence mode="wait">
                                    <motion.div
                                        key={current.color ?? 'none'}
                                        className="px-[8px] py-[3px]"
                                        style={{
                                            backgroundColor: pickColor(current.colorHex, current.color),
                                            color: '#ffffff',
                                        }}
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: current.color ? 1 : 0 }}
                                        exit={{ opacity: 0 }}
                                        transition={{ duration: 0.2 }}
                                    >
                                        <span className="font-reformat text-[20px] tracking-[-0.01em] uppercase leading-none">
                                            {current.color ?? ''}
                                        </span>
                                    </motion.div>
                                </AnimatePresence>
                            </div>
                            <div className="overflow-hidden">
                                <AnimatePresence mode="wait">
                                    <motion.span
                                        key={primaryDetail.size}
                                        className="font-reformat text-[20px] tracking-[-0.01em] leading-none block"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        transition={{ duration: 0.2 }}
                                    >
                                        SIZE: {primaryDetail.size}
                                    </motion.span>
                                </AnimatePresence>
                            </div>
                        </div>

                        <div className="px-5 pb-3 flex-shrink-0">
                            <ItemUnavailableButton
                                task={current}
                                onItemRefunded={() => { markTask(taskIndex, 'missing'); advanceTask(undefined, 'missing') }}
                                onOrderCancelled={(orderId) => { markTask(taskIndex, 'missing'); advanceTask(orderId, 'missing') }}
                            />
                        </div>

                        <PickToggleBar
                            status={taskStatuses[taskIndex]}
                            allResolved={tasks.every((_, i) => taskStatuses[i])}
                            accent={pickColor(current.colorHex, current.color)}
                            onToggle={() => {
                                const cur = taskStatuses[taskIndex]
                                if (cur === 'picked') {
                                    setTaskStatuses(prev => {
                                        const next = { ...prev }
                                        delete next[taskIndex]
                                        return next
                                    })
                                } else {
                                    markTask(taskIndex, 'picked')
                                }
                            }}
                            onDone={() => {
                                if (shipOrders.length === 0) router.push('/admin/orders')
                                else setPhase('shipping')
                            }}
                        />
                    </motion.div>
                )
            })()}

            {/* ── Shipping ── */}
            {phase === 'shipping' && shipOrders.length > 0 && (() => {
                const currentShip = shipOrders[shipIndex]
                const shipCreatedAt = orders.find(o => o.id === currentShip.id)?.createdAt ?? new Date()
                const pastShipPills = shipOrders.slice(0, shipIndex).map(o => ({
                    orderId: o.id,
                    label: o.orderNumber.slice(-3),
                    createdAt: orders.find(x => x.id === o.id)?.createdAt ?? new Date(),
                }))
                const upcomingShipPills = shipOrders.slice(shipIndex + 1, shipIndex + 5).map(o => ({
                    orderId: o.id,
                    label: o.orderNumber.slice(-3),
                    createdAt: orders.find(x => x.id === o.id)?.createdAt ?? new Date(),
                }))

                return (
                    <motion.div
                        key="shipping"
                        className="fixed inset-0 flex flex-col bg-[#f2f2f2]"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.18 }}
                    >
                        {/* White header slab */}
                        <div className="flex-shrink-0 bg-white pt-8 pb-5 px-5 relative">
                            <button
                                onClick={() => {
                                    if (shipIndex > 0) {
                                        setShipIndex(i => i - 1)
                                    } else {
                                        setPhase('picking')
                                        setTaskIndex(tasks.length - 1)
                                    }
                                }}
                                className="absolute right-5 top-8 text-[11px] font-medium text-neutral-400"
                            >
                                ← back
                            </button>
                            <p className="font-alte text-[53px] leading-none tracking-[-0.03em] text-black mb-4">
                                Shipping
                            </p>
                            <div className="flex gap-[6px] overflow-x-auto [&::-webkit-scrollbar]:hidden">
                                <AnimatePresence>
                                    {pastShipPills.map((p) => (
                                        <motion.div
                                            key={p.orderId}
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 0.45 }}
                                            exit={{ opacity: 0 }}
                                            transition={{ duration: 0.2 }}
                                        >
                                            <OrderBadge label={p.label} createdAt={p.createdAt} done />
                                        </motion.div>
                                    ))}
                                    <motion.div
                                        key={currentShip.id}
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        transition={{ duration: 0.2 }}
                                    >
                                        <OrderBadge label={currentShip.orderNumber.slice(-3)} createdAt={shipCreatedAt} />
                                    </motion.div>
                                    {upcomingShipPills.map((p) => (
                                        <motion.div
                                            key={p.orderId}
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 0.2 }}
                                            exit={{ opacity: 0 }}
                                            transition={{ duration: 0.2 }}
                                        >
                                            <OrderBadge label={p.label} createdAt={p.createdAt} />
                                        </motion.div>
                                    ))}
                                </AnimatePresence>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto px-5 pt-5 flex flex-col gap-4">
                            {currentShip.items.length > 0 && (
                                <div className="flex gap-2 flex-wrap">
                                    {currentShip.items.map((item, j) => (
                                        <div key={j} className="flex flex-col items-center gap-1">
                                            <motion.div
                                                layoutId={`photo-${currentShip.id}-${item.productId}`}
                                                transition={spring}
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
                                            </motion.div>
                                            <span className="text-[8px] text-neutral-400 font-medium">
                                                {item.size}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="bg-white rounded-[10px] px-4 py-4">
                                <p className="text-[9px] font-semibold tracking-[0.12em] text-neutral-400 mb-3">
                                    SHIP TO
                                </p>
                                <p className="text-[14px] font-semibold text-neutral-800 leading-snug">
                                    {currentShip.recipientName}
                                </p>
                                <p className="text-[12px] text-neutral-500 mt-1 leading-relaxed whitespace-pre-line">
                                    {currentShip.address}{'\n'}{currentShip.city}, {currentShip.state} {currentShip.zip}{'\n'}{currentShip.country}
                                </p>
                                <p className="text-[11px] text-neutral-400 mt-3">{currentShip.email}</p>
                            </div>
                        </div>

                        <TrackingSheet
                            orderId={currentShip.id}
                            onShipped={() => {
                                if (shipIndex < shipOrders.length - 1) {
                                    setShipIndex(i => i + 1)
                                } else {
                                    router.push('/admin/orders')
                                }
                            }}
                        />
                    </motion.div>
                )
            })()}

            </AnimatePresence>

            {/* ── Mode modal ── */}
            {showModeModal && (
                <div
                    className="fixed inset-0 z-50 flex items-end bg-black/20"
                    onClick={() => setShowModeModal(false)}
                >
                    <div
                        className="w-full bg-white rounded-t-[2rem] px-6 pt-6 pb-12"
                        onClick={e => e.stopPropagation()}
                    >
                        <p className="text-[11px] text-neutral-400 mb-5 text-center tracking-wide">
                            {selectedIds.size} ORDER{selectedIds.size !== 1 ? 'S' : ''} SELECTED
                        </p>
                        <div className="flex flex-col gap-3">
                            <button
                                onClick={() => beginRun('sequential')}
                                className="w-full py-5 rounded-2xl bg-neutral-900 text-white text-[15px] font-semibold"
                            >
                                Sequential
                                <span className="block text-[11px] font-normal text-neutral-400 mt-0.5">
                                    One order at a time
                                </span>
                            </button>
                            <button
                                onClick={() => beginRun('batch')}
                                className="w-full py-5 rounded-2xl bg-neutral-100 text-neutral-900 text-[15px] font-semibold"
                            >
                                Batch
                                <span className="block text-[11px] font-normal text-neutral-500 mt-0.5">
                                    All items grouped by product
                                </span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </LayoutGroup>
    )
}

// ── Progress Strip ────────────────────────────────────────────────────────────

function ProgressStrip({
    tasks,
    taskIndex,
    taskStatuses,
    onJump,
}: {
    tasks: PickTask[]
    taskIndex: number
    taskStatuses: Record<number, TaskStatus>
    onJump?: (index: number) => void
}) {
    const currentRef = useRef<HTMLButtonElement>(null)

    useEffect(() => {
        currentRef.current?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
    }, [taskIndex])

    return (
        <div className="flex gap-[5px] overflow-x-auto px-5 pt-4 pb-3 flex-shrink-0 [&::-webkit-scrollbar]:hidden">
            {tasks.map((t, i) => {
                const status = taskStatuses[i]
                const isCurrent = i === taskIndex
                const isFuture = !isCurrent && !status
                const lid = `photo-${tasks[i].details[0].orderId}-${tasks[i].productId}`

                return (
                    <button
                        key={i}
                        ref={isCurrent ? currentRef : undefined}
                        type="button"
                        onClick={() => onJump?.(i)}
                        className="flex flex-col items-center gap-[4px] flex-shrink-0 cursor-pointer active:scale-95 transition-transform"
                        aria-label={`Jump to item ${i + 1}`}
                    >
                        <motion.div
                            layoutId={lid}
                            initial={{ opacity: 0, x: -16 }}
                            animate={
                                isCurrent
                                    ? { opacity: 1, x: 0, scale: [1, 1.06, 1] }
                                    : { opacity: 1, x: 0, scale: 1 }
                            }
                            transition={
                                isCurrent
                                    ? {
                                        ...spring,
                                        delay: i * 0.04,
                                        opacity: { duration: 0.2, delay: i * 0.04 },
                                        scale: { duration: 1.8, repeat: Infinity, ease: 'easeInOut' },
                                    }
                                    : { ...spring, delay: i * 0.04, opacity: { duration: 0.2, delay: i * 0.04 } }
                            }
                            className="relative rounded-[4px] overflow-hidden flex-shrink-0"
                            style={{ width: 26, height: 34 }}
                        >
                            {t.cartPhoto ? (
                                <Image
                                    src={t.cartPhoto}
                                    alt=""
                                    fill
                                    className={`object-cover ${isFuture ? 'grayscale opacity-35' : ''}`}
                                    sizes="26px"
                                />
                            ) : (
                                <div className={`absolute inset-0 bg-neutral-300 ${isFuture ? 'opacity-35' : ''}`} />
                            )}
                            {status === 'missing' && (
                                <div className="absolute inset-0 bg-red-500/40" />
                            )}
                        </motion.div>
                        <motion.span
                            className="rounded-full flex-shrink-0"
                            style={{
                                width: 4,
                                height: 4,
                                backgroundColor: isCurrent ? '#3b82f6' : status === 'picked' ? '#22c55e' : status === 'missing' ? '#f87171' : 'transparent',
                            }}
                            animate={isCurrent ? { opacity: [1, 0.4, 1] } : { opacity: 1 }}
                            transition={isCurrent ? { duration: 1.8, repeat: Infinity, ease: 'easeInOut' } : undefined}
                        />
                    </button>
                )
            })}
        </div>
    )
}

// ── Pick Toggle Bar ──────────────────────────────────────────────────────────

function PickToggleBar({
    status,
    allResolved,
    accent,
    onToggle,
    onDone,
}: {
    status: TaskStatus | undefined
    allResolved: boolean
    accent: string
    onToggle: () => void
    onDone: () => void
}) {
    const isPicked = status === 'picked'
    const isMissing = status === 'missing'

    return (
        <div className="flex-shrink-0 bg-white px-5 pt-5 pb-8 flex items-center justify-between gap-4">
            <button
                onClick={onToggle}
                disabled={isMissing}
                className="flex items-center gap-3 disabled:opacity-50"
            >
                <motion.span
                    whileTap={{ scale: 0.9 }}
                    className="rounded-full border-2 flex items-center justify-center transition-colors"
                    style={{
                        width: 36,
                        height: 36,
                        borderColor: isPicked ? accent : isMissing ? '#f87171' : '#d4d4d4',
                        backgroundColor: isPicked ? accent : isMissing ? '#fee2e2' : 'transparent',
                    }}
                >
                    {isPicked && (
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                            <polyline
                                points="2,7.5 5.5,11 12,3.5"
                                stroke="white"
                                strokeWidth="2.2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </svg>
                    )}
                    {isMissing && (
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                            <line x1="3" y1="3" x2="9" y2="9" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" />
                            <line x1="9" y1="3" x2="3" y2="9" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                    )}
                </motion.span>
                <span className="text-[15px] font-semibold tracking-tight">
                    {isPicked ? 'Picked' : isMissing ? 'Unavailable' : 'Mark as picked'}
                </span>
            </button>

            <AnimatePresence>
                {allResolved && (
                    <motion.button
                        key="done"
                        onClick={onDone}
                        initial={{ opacity: 0, x: 8 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 8 }}
                        className="text-[14px] font-semibold tracking-tight flex items-center gap-1"
                        style={{ color: accent }}
                    >
                        Done picking
                        <span className="text-[16px] leading-none">→</span>
                    </motion.button>
                )}
            </AnimatePresence>
        </div>
    )
}

// ── Calculating Screen ───────────────────────────────────────────────────────

function CalculatingBody({
    summary,
    onContinue,
}: {
    summary: CalcSummary
    onContinue: () => void
}) {
    const messages = [
        'Determining pick order',
        'Grouping items into parcels',
        'Calculating optimal pick route',
        'Verifying inventory',
    ]
    const [step, setStep] = useState(0)
    const done = step >= messages.length

    useEffect(() => {
        if (done) return
        const t = setTimeout(() => setStep(s => s + 1), 1100)
        return () => clearTimeout(t)
    }, [step, done])

    return (
        <>
            {!done && <StaticBurst />}
            <AnimatePresence mode="wait">
                {!done ? (
                    <motion.div
                        key="loader"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.25 }}
                        className="flex flex-col items-center gap-6"
                    >
                        <motion.div
                            className="rounded-full"
                            style={{
                                width: 42,
                                height: 42,
                                border: '3px solid rgba(0,0,0,0.12)',
                                borderTopColor: '#000',
                            }}
                            animate={{ rotate: [0, 360] }}
                            transition={{ duration: 0.85, repeat: Infinity, ease: 'linear' }}
                        />
                        <div className="h-6 overflow-hidden text-center">
                            <AnimatePresence mode="wait">
                                <motion.p
                                    key={step}
                                    initial={{ opacity: 0, y: 12 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -12 }}
                                    transition={{ duration: 0.3 }}
                                    className="font-reformat text-[12px] tracking-[0.12em] uppercase text-neutral-600"
                                >
                                    {messages[step] ?? messages[messages.length - 1]}
                                </motion.p>
                            </AnimatePresence>
                        </div>
                    </motion.div>
                ) : (
                    <motion.div
                        key="summary"
                        initial={{ opacity: 0, scale: 0.96 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.3 }}
                        className="flex flex-col items-center gap-8 max-w-sm w-full"
                    >
                        <div className="bg-white px-6 py-7 w-full text-center">
                            <p className="font-alte text-[28px] tracking-[-0.02em] leading-tight text-black mb-3">
                                Mapped {summary.itemCount} item{summary.itemCount === 1 ? '' : 's'}
                                <br />
                                into {summary.taskCount} parcel{summary.taskCount === 1 ? '' : 's'}
                                <br />
                                for {summary.orderCount} order{summary.orderCount === 1 ? '' : 's'}.
                            </p>
                        </div>
                        <button
                            onClick={onContinue}
                            className="font-alte font-bold text-[28px] tracking-[-0.02em] text-black"
                        >
                            Begin picking first item →
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    )
}

// ── Grain / Static Overlays ──────────────────────────────────────────────────

const NOISE_TILE =
    "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix type='matrix' values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.55 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")"

function GrainOverlay() {
    return (
        <div
            aria-hidden
            className="pointer-events-none fixed inset-0 z-[60] mix-blend-multiply"
            style={{ opacity: 0.07, backgroundImage: NOISE_TILE }}
        />
    )
}

function StaticBurst() {
    return (
        <motion.div
            aria-hidden
            className="pointer-events-none fixed inset-0 z-[55] mix-blend-multiply"
            style={{
                backgroundImage: NOISE_TILE,
                backgroundSize: '200px 200px',
            }}
            initial={{ opacity: 0 }}
            animate={{
                opacity: [0.14, 0.2, 0.16, 0.22, 0.15],
                backgroundPosition: [
                    '0px 0px',
                    '40px 20px',
                    '-20px 35px',
                    '25px -25px',
                    '0px 0px',
                ],
            }}
            exit={{ opacity: 0 }}
            transition={{
                opacity: { duration: 2.4, repeat: Infinity, ease: 'easeInOut' },
                backgroundPosition: { duration: 2.4, repeat: Infinity, ease: 'easeInOut' },
            }}
        />
    )
}

// ── Tracking Sheet ───────────────────────────────────────────────────────────

function TrackingSheet({
    orderId,
    onShipped,
}: {
    orderId: string
    onShipped: () => void
}) {
    const [open, setOpen] = useState(false)
    const [tracking, setTracking] = useState('')
    const [loading, setLoading] = useState<'quote' | 'buy' | 'manual' | 'later' | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [quote, setQuote] = useState<ShippoQuote | null>(null)

    function reset() {
        setOpen(false)
        setTracking('')
        setQuote(null)
        setError(null)
    }

    async function handleGetQuote() {
        setLoading('quote')
        setError(null)
        try {
            const q = await quoteShippoLabel(orderId)
            setQuote(q)
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to fetch rate')
        } finally {
            setLoading(null)
        }
    }

    async function handleConfirmPurchase() {
        if (!quote) return
        setLoading('buy')
        setError(null)
        try {
            const result = await purchaseShippoLabel(orderId, quote.rateId)
            window.open(result.labelUrl, '_blank', 'noopener,noreferrer')
            reset()
            onShipped()
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to buy label')
        } finally {
            setLoading(null)
        }
    }

    async function handleManual(trackingNumber?: string) {
        setLoading(trackingNumber ? 'manual' : 'later')
        try {
            await markOrderShipped(orderId, trackingNumber)
            reset()
            onShipped()
        } finally {
            setLoading(null)
        }
    }

    const busy = loading !== null

    return (
        <>
            <div className="flex-shrink-0 bg-white">
                <button
                    onClick={() => setOpen(true)}
                    disabled={busy}
                    className="w-full text-center text-[26px] font-semibold tracking-tight py-7 disabled:text-neutral-300 transition-colors"
                >
                    Mark Shipped
                </button>
            </div>

            {open && (
                <div
                    className="fixed inset-0 z-50 flex items-end bg-black/20"
                    onClick={() => !busy && setOpen(false)}
                >
                    <div
                        className="w-full bg-white rounded-t-[2rem] px-6 pt-6 pb-12"
                        onClick={e => e.stopPropagation()}
                    >
                        <p className="text-[11px] font-semibold tracking-[0.12em] text-neutral-400 mb-5 text-center">
                            SHIP THIS ORDER
                        </p>

                        <div className="flex flex-col gap-2 mb-5">
                            {quote ? (
                                <div className="rounded-2xl border border-neutral-200 px-4 py-4">
                                    <div className="flex items-baseline justify-between mb-2">
                                        <span className="text-[12px] font-semibold text-neutral-700">
                                            {quote.provider} {quote.serviceName}
                                        </span>
                                        <span className="text-[18px] font-semibold tabular-nums">
                                            ${parseFloat(quote.amount).toFixed(2)}
                                            <span className="text-[10px] text-neutral-400 ml-1">{quote.currency}</span>
                                        </span>
                                    </div>
                                    {quote.estimatedDays !== null && (
                                        <p className="text-[11px] text-neutral-500 mb-3">
                                            Est. {quote.estimatedDays} day{quote.estimatedDays === 1 ? '' : 's'} in transit
                                        </p>
                                    )}
                                    <div className="flex flex-col gap-2">
                                        <button
                                            onClick={handleConfirmPurchase}
                                            disabled={busy}
                                            className="w-full py-3 rounded-xl bg-neutral-900 text-white text-[13px] font-semibold disabled:opacity-40 transition-opacity"
                                        >
                                            {loading === 'buy' ? 'Buying label...' : `Confirm & Buy $${parseFloat(quote.amount).toFixed(2)}`}
                                        </button>
                                        <button
                                            onClick={() => setQuote(null)}
                                            disabled={busy}
                                            className="w-full py-2 text-[11px] text-neutral-500 disabled:opacity-40"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <button
                                    onClick={handleGetQuote}
                                    disabled={busy}
                                    className="w-full py-4 rounded-2xl bg-neutral-900 text-white text-[14px] font-semibold disabled:opacity-40 transition-opacity"
                                >
                                    {loading === 'quote' ? 'Fetching rate...' : 'Get Shippo Rate'}
                                    <span className="block text-[11px] font-normal text-neutral-400 mt-0.5">
                                        Preview cheapest USPS price before buying
                                    </span>
                                </button>
                            )}
                        </div>

                        {error && (
                            <p className="text-[11px] text-red-500 mb-4 text-center break-words">{error}</p>
                        )}

                        <p className="text-[10px] text-neutral-400 mb-2 text-center tracking-wide">
                            OR ENTER TRACKING MANUALLY
                        </p>
                        <input
                            type="text"
                            value={tracking}
                            onChange={e => setTracking(e.target.value)}
                            placeholder="Tracking number"
                            disabled={busy}
                            className="w-full border border-neutral-200 rounded-xl px-4 py-3 text-[14px] mb-3 outline-none focus:border-neutral-400 transition-colors disabled:opacity-50"
                        />
                        <div className="flex flex-col gap-2">
                            <button
                                onClick={() => handleManual(tracking)}
                                disabled={busy || !tracking.trim()}
                                className="w-full py-4 rounded-2xl bg-neutral-100 text-neutral-900 text-[14px] font-semibold disabled:opacity-40 transition-opacity"
                            >
                                {loading === 'manual' ? '...' : 'Save Tracking & Ship'}
                            </button>
                            <button
                                onClick={() => handleManual()}
                                disabled={busy}
                                className="w-full py-4 rounded-2xl bg-neutral-100 text-neutral-500 text-[14px] font-semibold disabled:opacity-40 transition-opacity"
                            >
                                {loading === 'later' ? '...' : 'Add Tracking Later'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}

// ── Item Unavailable ──────────────────────────────────────────────────────────

function ItemUnavailableButton({
    task,
    onItemRefunded,
    onOrderCancelled,
}: {
    task: PickTask
    onItemRefunded: () => void
    onOrderCancelled: (orderId: string) => void
}) {
    const [showSheet, setShowSheet] = useState(false)

    return (
        <>
            <button
                onClick={() => setShowSheet(true)}
                className="text-[10px] text-neutral-400 font-medium"
            >
                Item unavailable?
            </button>

            {showSheet && (
                <ItemUnavailableSheet
                    task={task}
                    onClose={() => setShowSheet(false)}
                    onItemRefunded={() => { setShowSheet(false); onItemRefunded() }}
                    onOrderCancelled={(orderId) => { setShowSheet(false); onOrderCancelled(orderId) }}
                />
            )}
        </>
    )
}

function ItemUnavailableSheet({
    task,
    onClose,
    onItemRefunded,
    onOrderCancelled,
}: {
    task: PickTask
    onClose: () => void
    onItemRefunded: () => void
    onOrderCancelled: (orderId: string) => void
}) {
    const [loading, setLoading] = useState<string | null>(null)
    const primary = task.details[0]

    const emailBody = encodeURIComponent(
        `Hi,\n\nWe're sorry, but we were unable to fulfill the following item from your order:\n\n` +
        `${task.productName} — Size ${primary.size} × ${primary.quantity}\n\n` +
        `We'll be in touch shortly regarding your options.\n\nThank you for your patience.`
    )
    const mailtoHref = `mailto:${primary.email}?subject=${encodeURIComponent(`Update on your order #${primary.orderLabel}`)}&body=${emailBody}`

    async function handlePartialRefund() {
        setLoading('refund')
        try {
            await Promise.all(task.details.map(d => partialRefundItem(d.orderId, Math.round(d.price * d.quantity * 100))))
            onItemRefunded()
        } finally { setLoading(null) }
    }

    async function handleCancelOrder() {
        setLoading('cancel')
        try {
            await Promise.all(task.details.map(d => cancelOrder(d.orderId)))
            onOrderCancelled(primary.orderId)
        } finally { setLoading(null) }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-end bg-black/20" onClick={onClose}>
            <div className="w-full bg-white rounded-t-[2rem] px-6 pt-6 pb-12" onClick={e => e.stopPropagation()}>
                <p className="text-[11px] font-semibold tracking-[0.12em] text-neutral-400 mb-1 text-center">ITEM UNAVAILABLE</p>
                <p className="text-[12px] text-neutral-500 text-center mb-6">{task.productName}</p>
                <div className="flex flex-col gap-3">
                    <a href={mailtoHref} className="w-full py-4 rounded-2xl bg-neutral-100 text-neutral-900 text-[14px] font-semibold text-center block" onClick={onClose}>
                        Email Customer
                        <span className="block text-[11px] font-normal text-neutral-500 mt-0.5">{primary.email}</span>
                    </a>
                    <button onClick={handlePartialRefund} disabled={!!loading} className="w-full py-4 rounded-2xl bg-neutral-100 text-neutral-900 text-[14px] font-semibold disabled:opacity-50 transition-opacity">
                        {loading === 'refund' ? 'Refunding...' : 'Partial Refund'}
                        <span className="block text-[11px] font-normal text-neutral-500 mt-0.5">Refund this item, continue with order</span>
                    </button>
                    <button onClick={handleCancelOrder} disabled={!!loading} className="w-full py-4 rounded-2xl bg-red-50 text-red-600 text-[14px] font-semibold disabled:opacity-50 transition-opacity">
                        {loading === 'cancel' ? 'Cancelling...' : 'Cancel Order'}
                        <span className="block text-[11px] font-normal text-red-400 mt-0.5">Full refund, remove from queue</span>
                    </button>
                </div>
            </div>
        </div>
    )
}
