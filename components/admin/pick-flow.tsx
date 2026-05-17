'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { motion, AnimatePresence, LayoutGroup, useMotionValue, useTransform, animate } from 'framer-motion'
import { markOrderShipped, partialRefundItem, cancelOrder } from '@/app/admin/pick/actions'
import { RoomOverviewSheet } from './room-overview-sheet'

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
    warehouseLocation: string | null
}

export type FlowOrder = {
    id: string
    orderNumber: string
    createdAt: Date
    email: string
    shippingAddress: Record<string, string>
    items: FlowOrderItem[]
}

export type PickTask = {
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
        boxNumber: number
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
        color: string | null
    }>
}

type Phase = 'queue' | 'calculating' | 'picking' | 'shipping'

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

function buildTasks(orders: FlowOrder[]): PickTask[] {
    const boxMap = new Map<string, number>()
    orders.forEach((o, i) => boxMap.set(o.id, i + 1))

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
                boxNumber: boxMap.get(order.id) ?? 1,
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
                color: item.color,
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
    const [tasks, setTasks] = useState<PickTask[]>([])
    const [taskIndex, setTaskIndex] = useState(0)
    const [taskStatuses, setTaskStatuses] = useState<Record<number, TaskStatus>>({})
    // Per-detail picked state: key = `${taskIndex}__${detailIndex}`. A task is
    // considered "fully picked" only when every one of its details is picked.
    // This lets the overview toggle individual SKUs independently even when
    // they share a product card in the swipe flow.
    const [pickedDetails, setPickedDetails] = useState<Set<string>>(new Set())
    const [shipOrders, setShipOrders] = useState<ShipOrder[]>([])
    const [shipIndex, setShipIndex] = useState(0)
    const [showOverview, setShowOverview] = useState(false)
    const [runOrders, setRunOrders] = useState<FlowOrder[]>([])

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

    function beginRun() {
        const selected = orders.filter(o => selectedIds.has(o.id))
        const builtTasks = buildTasks(selected)
        const builtShip = buildShipOrders(selected)
        setTasks(builtTasks)
        setShipOrders(builtShip)
        setRunOrders(selected)
        setTaskIndex(0)
        setTaskStatuses({})
        setPickedDetails(new Set())
        setShipIndex(0)
        setPhase('calculating')
    }

    const detailKey = (ti: number, di: number) => `${ti}__${di}`

    // A task is fully picked when every detail row of that task has been
    // checked off. Used everywhere we previously read taskStatuses[i] === 'picked'.
    function isTaskFullyPicked(ti: number, taskList: PickTask[] = tasks, picked: Set<string> = pickedDetails): boolean {
        const t = taskList[ti]
        if (!t) return false
        for (let di = 0; di < t.details.length; di++) {
            if (!picked.has(detailKey(ti, di))) return false
        }
        return true
    }

    // A task is "resolved" (i.e. nothing more to do for it) when it's been
    // marked missing OR every one of its details has been picked.
    function isTaskResolved(ti: number, taskList: PickTask[] = tasks, picked: Set<string> = pickedDetails, statuses = taskStatuses): boolean {
        if (statuses[ti] === 'missing') return true
        return isTaskFullyPicked(ti, taskList, picked)
    }

    function markTaskMissing(index: number) {
        setTaskStatuses(prev => ({ ...prev, [index]: 'missing' }))
        // Clear any per-detail picks for the missing task so they don't
        // count toward the overview's "X/Y items picked" tally.
        setPickedDetails(prev => {
            const next = new Set(prev)
            const t = tasks[index]
            if (t) {
                for (let di = 0; di < t.details.length; di++) next.delete(detailKey(index, di))
            }
            return next
        })
    }

    // Swipe-card "I picked this product" toggle: flips ALL details of the
    // task between picked and unpicked together. Per-detail toggles still
    // happen via the overview (togglePickedDetail).
    function toggleAllPickedForTask(index: number) {
        if (taskStatuses[index] === 'missing') return
        setPickedDetails(prev => {
            const next = new Set(prev)
            const t = tasks[index]
            if (!t) return prev
            const currentlyAll = t.details.every((_, di) => next.has(detailKey(index, di)))
            if (currentlyAll) {
                for (let di = 0; di < t.details.length; di++) next.delete(detailKey(index, di))
            } else {
                for (let di = 0; di < t.details.length; di++) next.add(detailKey(index, di))
            }
            return next
        })
    }

    // Missing-flow handlers triggered from the overview sheet. These mark
    // the task missing without auto-advancing the swipe view (the user is
    // looking at the overview, not a card). On cancel we also remove the
    // affected order from the shipping queue.
    function markMissingFromOverview(ti: number) {
        markTaskMissing(ti)
    }
    function cancelOrderFromOverview(ti: number, orderId: string) {
        markTaskMissing(ti)
        setShipOrders(prev => prev.filter(o => o.id !== orderId))
    }

    function togglePickedDetail(taskIndex: number, detailIndex: number) {
        // Don't allow per-detail toggling while a task is marked missing —
        // the swipe-card flow owns that state.
        if (taskStatuses[taskIndex] === 'missing') return
        setPickedDetails(prev => {
            const key = detailKey(taskIndex, detailIndex)
            const next = new Set(prev)
            if (next.has(key)) next.delete(key)
            else next.add(key)
            return next
        })
    }

    function advanceTask(removedOrderId?: string, justMarkedStatus?: TaskStatus) {
        if (removedOrderId) {
            setShipOrders(prev => prev.filter(o => o.id !== removedOrderId))
        }
        const resolvedIndices = new Set<number>()
        for (let i = 0; i < tasks.length; i++) {
            if (isTaskResolved(i)) resolvedIndices.add(i)
        }
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
                            {orders.length === 0 ? (
                                <div className="flex-1 flex flex-col items-center justify-center px-8 gap-6">
                                    <span className="font-alte text-[36px] tracking-[-0.03em] leading-none opacity-20">Pick Queue</span>
                                    <span className="text-[13px] font-medium text-neutral-400 text-center leading-relaxed">
                                        No orders waiting to ship.
                                    </span>
                                </div>
                            ) : (
                            <>
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
                                    onClick={() => !noneSelected && beginRun()}
                                    disabled={noneSelected}
                                    className="w-full text-center font-alte font-bold text-[36px] tracking-[-0.03em] py-7 transition-colors"
                                    style={{ color: noneSelected ? '#c0c0c0' : '#1a1a1a' }}
                                >
                                    Begin
                                </button>
                            </div>
                            </>
                            )}
                        </div>
                    </motion.div>
                )}

            {/* ── Calculating ── */}
            {phase === 'calculating' && (
                <motion.div
                    key="calculating"
                    className="fixed inset-0 flex flex-col bg-[#f2f2f2] items-center justify-center"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.18 }}
                >
                    <CalculatingBody onContinue={() => setPhase('picking')} />
                </motion.div>
            )}

            {/* ── Picking ── */}
            {phase === 'picking' && tasks.length > 0 && (() => {
                const current = tasks[taskIndex]
                const totalQty = current.details.reduce((s, d) => s + d.quantity, 0)
                // An order is fully resolved only when, for every task containing it,
                // either the task is marked missing OR every detail of that order
                // within the task has been picked.
                const orderIsFullyResolved = (orderId: string): boolean => {
                    for (let i = 0; i < tasks.length; i++) {
                        const t = tasks[i]
                        if (taskStatuses[i] === 'missing') continue
                        for (let di = 0; di < t.details.length; di++) {
                            if (t.details[di].orderId !== orderId) continue
                            if (!pickedDetails.has(detailKey(i, di))) return false
                        }
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
                            <div className="flex items-baseline gap-[14px] mb-4">
                                <span className="font-alte text-[53px] leading-none tracking-[-0.03em] text-black">
                                    Queue
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setShowOverview(true)}
                                    className="font-alte text-[53px] leading-none tracking-[-0.03em] text-black opacity-[0.18] active:opacity-40 transition-opacity"
                                >
                                    Overview
                                </button>
                            </div>
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
                            taskStatuses={(() => {
                                const derived: Record<number, TaskStatus> = {}
                                for (let i = 0; i < tasks.length; i++) {
                                    if (taskStatuses[i] === 'missing') derived[i] = 'missing'
                                    else if (isTaskFullyPicked(i)) derived[i] = 'picked'
                                }
                                return derived
                            })()}
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
                            className="flex-1 mx-auto relative w-full max-w-[240px]"
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
                                        const firstUnresolved = tasks.findIndex((_, i) => !isTaskResolved(i))
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

                        {/* Caret navigation */}
                        <div className="flex items-center justify-between px-5 pt-3 pb-1 flex-shrink-0">
                            <button
                                onClick={() => taskIndex > 0 && setTaskIndex(i => i - 1)}
                                disabled={taskIndex === 0}
                                className="text-[32px] leading-none font-bold text-black/25 disabled:opacity-0 active:text-black/50 transition-opacity px-2 py-1"
                                aria-label="Previous item"
                            >
                                ‹
                            </button>
                            <button
                                onClick={() => {
                                    if (taskIndex < tasks.length - 1) {
                                        setTaskIndex(i => i + 1)
                                    } else {
                                        const firstUnresolved = tasks.findIndex((_, i) => !isTaskResolved(i))
                                        if (firstUnresolved !== -1 && firstUnresolved !== taskIndex) setTaskIndex(firstUnresolved)
                                    }
                                }}
                                disabled={taskIndex === tasks.length - 1}
                                className="text-[32px] leading-none font-bold text-black/25 disabled:opacity-0 active:text-black/50 transition-opacity px-2 py-1"
                                aria-label="Next item"
                            >
                                ›
                            </button>
                        </div>

                        {/* Color swatch + size */}
                        <div className="flex items-center justify-between px-5 pt-3 pb-4 flex-shrink-0">
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
                            <div className="flex flex-col items-end gap-[5px]">
                                {current.details.map((d, di) => (
                                    <div key={`${d.orderId}-${d.size}-${di}`} className="flex items-center gap-[6px]">
                                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
                                            <path d="M2 5L8 2L14 5L8 8L2 5Z" stroke="#1a1a1a" strokeWidth="1.2" strokeLinejoin="round" />
                                            <path d="M2 5V11L8 14V8" stroke="#1a1a1a" strokeWidth="1.2" strokeLinejoin="round" />
                                            <path d="M14 5V11L8 14" stroke="#1a1a1a" strokeWidth="1.2" strokeLinejoin="round" />
                                        </svg>
                                        <span className="font-alte font-bold text-[15px] leading-none text-black">
                                            {d.boxNumber}
                                        </span>
                                        <span className="font-reformat text-[11px] tracking-[0.06em] text-neutral-500 leading-none">
                                            S:{d.size} ×{d.quantity}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="px-5 pb-3 flex-shrink-0">
                            <ItemUnavailableButton
                                task={current}
                                onItemRefunded={() => { markTaskMissing(taskIndex); advanceTask(undefined, 'missing') }}
                                onOrderCancelled={(orderId) => { markTaskMissing(taskIndex); advanceTask(orderId, 'missing') }}
                            />
                        </div>

                        {(() => {
                            const totalQty = tasks.reduce((sum, t, i) =>
                                taskStatuses[i] === 'missing' ? sum : sum + t.details.reduce((s, d) => s + d.quantity, 0), 0)
                            const pickedQty = tasks.reduce((sum, t, i) => {
                                if (taskStatuses[i] === 'missing') return sum
                                if (!isTaskFullyPicked(i)) return sum
                                return sum + t.details.reduce((s, d) => s + d.quantity, 0)
                            }, 0)
                            return (
                                <PickToggleBar
                                    status={taskStatuses[taskIndex] === 'missing' ? 'missing' : (isTaskFullyPicked(taskIndex) ? 'picked' : undefined)}
                                    allResolved={tasks.every((_, i) => isTaskResolved(i))}
                                    accent={pickColor(current.colorHex, current.color)}
                                    onToggle={() => toggleAllPickedForTask(taskIndex)}
                                    onDone={() => {
                                        if (shipOrders.length === 0) router.push('/admin/orders')
                                        else setPhase('shipping')
                                    }}
                                    pickedQty={pickedQty}
                                    totalQty={totalQty}
                                />
                            )
                        })()}
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

                        <div className="flex-1 overflow-y-auto">
                            {/* ── Items list — overview-style flat rows ── */}
                            {currentShip.items.length > 0 && (
                                <div className="bg-white divide-y divide-[#f8f8f8]">
                                    {currentShip.items.map((item, j) => (
                                        <div key={j} className="flex items-center px-5 py-[10px] gap-[12px]">
                                            <div className="relative flex-shrink-0" style={{ width: 36, height: 40 }}>
                                                {item.cartPhoto ? (
                                                    <Image
                                                        src={item.cartPhoto}
                                                        alt=""
                                                        fill
                                                        className="object-contain"
                                                        sizes="36px"
                                                    />
                                                ) : (
                                                    <div className="w-full h-full bg-neutral-100" />
                                                )}
                                            </div>
                                            <span className="font-alte text-[12px] leading-none truncate flex-1 min-w-0">
                                                {item.productName}
                                            </span>
                                            {item.color && (
                                                <span className="font-reformat text-[9px] text-neutral-500 tracking-[0.1em] uppercase flex-shrink-0">
                                                    {item.color}
                                                </span>
                                            )}
                                            <span className="font-reformat text-[9px] text-neutral-500 tracking-[0.1em] uppercase flex-shrink-0">
                                                S:{item.size}
                                            </span>
                                            {item.quantity > 1 && (
                                                <span className="font-reformat text-[10px] font-bold tracking-[-0.01em] tabular-nums flex-shrink-0">
                                                    ×{item.quantity}
                                                </span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* ── Ship-to address ── */}
                            <div className="px-5 pt-4 pb-5">
                                <div className="bg-white px-4 py-4">
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

            {/* ── Room Overview trigger (visible on queue + shipping; picking screen has tab in header) ── */}
            {phase !== 'calculating' && phase !== 'picking' && (
                <motion.button
                    key="overview-trigger"
                    onClick={() => setShowOverview(true)}
                    className="fixed z-[65] flex items-center gap-[5px] bg-white px-[10px] py-[7px] shadow-sm"
                    style={{ top: 32, left: 20 }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.18 }}
                    aria-label="Open room overview"
                >
                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                        <line x1="1" y1="3" x2="12" y2="3" stroke="#1a1a1a" strokeWidth="1.4" strokeLinecap="round" />
                        <line x1="1" y1="6.5" x2="12" y2="6.5" stroke="#1a1a1a" strokeWidth="1.4" strokeLinecap="round" />
                        <line x1="1" y1="10" x2="8" y2="10" stroke="#1a1a1a" strokeWidth="1.4" strokeLinecap="round" />
                    </svg>
                    <span className="font-reformat text-[9px] tracking-[0.1em] font-bold uppercase text-black">
                        Overview
                    </span>
                </motion.button>
            )}

            {/* ── Room Overview Sheet ── */}
            <RoomOverviewSheet
                open={showOverview}
                orders={phase === 'queue' ? orders : runOrders}
                selectedIds={phase === 'queue' ? selectedIds : undefined}
                onToggleOrder={phase === 'queue' ? toggleOrder : undefined}
                tasks={phase !== 'queue' ? tasks : undefined}
                taskStatuses={phase !== 'queue' ? taskStatuses : undefined}
                pickedDetails={phase !== 'queue' ? pickedDetails : undefined}
                onTogglePickedDetail={phase !== 'queue' ? togglePickedDetail : undefined}
                onMarkMissingFromOverview={phase !== 'queue' ? markMissingFromOverview : undefined}
                onCancelOrderFromOverview={phase !== 'queue' ? cancelOrderFromOverview : undefined}
                onClose={() => setShowOverview(false)}
                onDone={phase !== 'queue' ? () => {
                    setShowOverview(false)
                    if (shipOrders.length === 0) router.push('/admin/orders')
                    else setPhase('shipping')
                } : undefined}
            />

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
    pickedQty,
    totalQty,
}: {
    status: TaskStatus | undefined
    allResolved: boolean
    accent: string
    onToggle: () => void
    onDone: () => void
    pickedQty: number
    totalQty: number
}) {
    const isPicked = status === 'picked'
    const isMissing = status === 'missing'

    return (
        <div className="flex-shrink-0 bg-white px-5 pt-5 pb-8 flex items-center justify-between gap-4">
            {/* Left slot: item counter — dims when all resolved */}
            <motion.span
                animate={{ opacity: allResolved ? 0.32 : 0.45 }}
                transition={{ duration: 0.22 }}
                className="text-[15px] font-semibold tracking-tight text-black"
            >
                {pickedQty}/{totalQty} items
            </motion.span>

            {/* Right slot: toggle button → Continue to shipping */}
            <AnimatePresence mode="wait" initial={false}>
                {allResolved ? (
                    <motion.button
                        key="continue"
                        onClick={onDone}
                        initial={{ opacity: 0, x: 8 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 8 }}
                        transition={{ duration: 0.22 }}
                        className="text-[15px] font-semibold tracking-tight flex items-center gap-1"
                        style={{ color: accent }}
                    >
                        Continue to shipping
                        <span className="text-[16px] leading-none">→</span>
                    </motion.button>
                ) : (
                    <motion.div
                        key="toggle"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.18 }}
                    >
                        <button
                            onClick={onToggle}
                            disabled={isMissing}
                            className="flex items-center gap-3 disabled:opacity-50"
                        >
                            <span className="text-[15px] font-semibold tracking-tight">
                                {isPicked ? 'Picked' : isMissing ? 'Unavailable' : 'Mark as picked'}
                            </span>
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
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

// ── Calculating Screen ───────────────────────────────────────────────────────

function CalculatingBody({ onContinue }: { onContinue: () => void }) {
    useEffect(() => {
        const t = setTimeout(onContinue, 650)
        return () => clearTimeout(t)
    }, [onContinue])

    return (
        <motion.div
            className="rounded-full"
            style={{
                width: 28,
                height: 28,
                border: '2.5px solid rgba(0,0,0,0.1)',
                borderTopColor: '#000',
            }}
            animate={{ rotate: [0, 360] }}
            transition={{ duration: 0.7, repeat: Infinity, ease: 'linear' }}
        />
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
    const [loading, setLoading] = useState<'save' | 'later' | null>(null)

    function reset() {
        setOpen(false)
        setTracking('')
    }

    async function handleShip(trackingNumber?: string) {
        setLoading(trackingNumber ? 'save' : 'later')
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
                            MARK AS SHIPPED
                        </p>

                        <p className="text-[10px] text-neutral-400 mb-2 tracking-wide">
                            TRACKING NUMBER (optional)
                        </p>
                        <input
                            type="text"
                            value={tracking}
                            onChange={e => setTracking(e.target.value)}
                            placeholder="e.g. 9400111899223450440756"
                            disabled={busy}
                            className="w-full border border-neutral-200 rounded-xl px-4 py-3 text-[14px] mb-4 outline-none focus:border-neutral-400 transition-colors disabled:opacity-50"
                        />
                        <div className="flex flex-col gap-2">
                            <button
                                onClick={() => handleShip(tracking.trim() || undefined)}
                                disabled={busy}
                                className="w-full py-4 rounded-2xl bg-neutral-900 text-white text-[14px] font-semibold disabled:opacity-40 transition-opacity"
                            >
                                {loading === 'save' ? '...' : tracking.trim() ? 'Save Tracking & Ship' : 'Mark Shipped'}
                            </button>
                            <button
                                onClick={() => handleShip()}
                                disabled={busy}
                                className="w-full py-3 rounded-2xl bg-neutral-100 text-neutral-500 text-[13px] font-semibold disabled:opacity-40 transition-opacity"
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

export function ItemUnavailableSheet({
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
    const [refundStep, setRefundStep] = useState<string>('Partial Refund')
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
            setRefundStep('Contacting Stripe...')
            await Promise.all(task.details.map(d => partialRefundItem(d.orderId, Math.round(d.price * d.quantity * 100))))
            setRefundStep('Verifying refund...')
            await new Promise(resolve => setTimeout(resolve, 500))
            setRefundStep('Refund complete')
            await new Promise(resolve => setTimeout(resolve, 400))
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
                        {loading === 'refund' ? refundStep : 'Partial Refund'}
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
