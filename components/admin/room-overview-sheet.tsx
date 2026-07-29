'use client'

import { useState, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'
import type { FlowOrder, PickTask } from './pick-flow'
import { ItemUnavailableSheet, MultiOrderUnavailableSheet } from './pick-flow'
import { AdminNav } from './admin-nav'

type TaskStatus = 'picked' | 'missing'

// ── Helpers ───────────────────────────────────────────────────────────────────

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

const UNASSIGNED_LABEL = 'General'

function roomLabel(loc: string | null): string {
    return loc?.trim() || UNASSIGNED_LABEL
}

// =============================================================================
// QUEUE-MODE (selection) data structures + builders
// =============================================================================

type GroupMode = 'order' | 'location'

interface RoomOrderGroup {
    room: string
    orders: Array<{
        orderId: string
        orderLabel: string
        createdAt: Date
        items: Array<{ productName: string; size: string; color: string | null; quantity: number }>
    }>
    roomTotal: number
}

interface RoomLocationGroup {
    room: string
    products: Array<{
        key: string
        productName: string
        color: string | null
        totalQty: number
        orders: Array<{ orderId: string; orderLabel: string; createdAt: Date; size: string; quantity: number }>
    }>
    roomTotal: number
}

function buildRoomOrderGroups(orders: FlowOrder[]): RoomOrderGroup[] {
    const roomMap = new Map<string, RoomOrderGroup>()
    for (const o of orders) {
        for (const item of o.items) {
            const room = roomLabel(item.warehouseLocation)
            if (!roomMap.has(room)) roomMap.set(room, { room, orders: [], roomTotal: 0 })
            const roomGroup = roomMap.get(room)!
            roomGroup.roomTotal += item.quantity
            const existingOrder = roomGroup.orders.find(x => x.orderId === o.id)
            const entry = { productName: item.productName, size: item.size, color: item.color, quantity: item.quantity }
            if (existingOrder) {
                existingOrder.items.push(entry)
            } else {
                roomGroup.orders.push({
                    orderId: o.id,
                    orderLabel: o.orderNumber.slice(-3),
                    createdAt: o.createdAt,
                    items: [entry],
                })
            }
        }
    }
    return [...roomMap.values()].sort((a, b) => a.room.localeCompare(b.room))
}

function buildRoomLocationGroups(orders: FlowOrder[]): RoomLocationGroup[] {
    const roomMap = new Map<string, RoomLocationGroup>()
    for (const o of orders) {
        for (const item of o.items) {
            const room = roomLabel(item.warehouseLocation)
            if (!roomMap.has(room)) roomMap.set(room, { room, products: [], roomTotal: 0 })
            const roomGroup = roomMap.get(room)!
            roomGroup.roomTotal += item.quantity
            const productKey = `${item.productId}__${item.color ?? ''}`
            const existingProduct = roomGroup.products.find(p => p.key === productKey)
            const orderEntry = {
                orderId: o.id,
                orderLabel: o.orderNumber.slice(-3),
                createdAt: o.createdAt,
                size: item.size,
                quantity: item.quantity,
            }
            if (existingProduct) {
                existingProduct.totalQty += item.quantity
                existingProduct.orders.push(orderEntry)
            } else {
                roomGroup.products.push({
                    key: productKey,
                    productName: item.productName,
                    color: item.color,
                    totalQty: item.quantity,
                    orders: [orderEntry],
                })
            }
        }
    }
    return [...roomMap.values()].sort((a, b) => a.room.localeCompare(b.room))
}

// =============================================================================
// PICKING-MODE data structures + builders
// =============================================================================

type PickingRow = {
    taskIndex: number
    detailIndex: number
    productName: string
    cartPhoto: string | null
    color: string | null
    size: string
    quantity: number
    warehouseLocation: string | null
    boxNumber: number
    orderId: string
    orderLabel: string
    createdAt: Date
}

type OrderGroup = {
    orderId: string
    orderLabel: string
    boxNumber: number
    createdAt: Date
    rows: PickingRow[]
    totalQty: number
}

function buildPickingRows(tasks: PickTask[], orders: FlowOrder[]): PickingRow[] {
    const locByProduct = new Map<string, string | null>()
    for (const o of orders) {
        for (const item of o.items) {
            locByProduct.set(item.productId, item.warehouseLocation)
        }
    }
    const rows: PickingRow[] = []
    tasks.forEach((task, taskIndex) => {
        task.details.forEach((detail, detailIndex) => {
            rows.push({
                taskIndex,
                detailIndex,
                productName: task.productName,
                cartPhoto: task.cartPhoto,
                color: task.color,
                size: detail.size,
                quantity: detail.quantity,
                warehouseLocation: locByProduct.get(task.productId) ?? null,
                boxNumber: detail.boxNumber,
                orderId: detail.orderId,
                orderLabel: detail.orderLabel,
                createdAt: detail.createdAt,
            })
        })
    })
    return rows
}

const detailKey = (taskIndex: number, detailIndex: number) => `${taskIndex}__${detailIndex}`

// Order-only grouping for the picking overview (matches the Figma design):
// one section per order, its item cards flattened out of the room buckets.
function buildOrderGroups(rows: PickingRow[]): OrderGroup[] {
    const map = new Map<string, OrderGroup>()
    for (const row of rows) {
        if (!map.has(row.orderId)) {
            map.set(row.orderId, {
                orderId: row.orderId,
                orderLabel: row.orderLabel,
                boxNumber: row.boxNumber,
                createdAt: row.createdAt,
                rows: [],
                totalQty: 0,
            })
        }
        const g = map.get(row.orderId)!
        g.totalQty += row.quantity
        g.rows.push(row)
    }
    return [...map.values()].sort((a, b) => a.boxNumber - b.boxNumber)
}

// ── Sub-components ────────────────────────────────────────────────────────────

function RoomHeader({ name, total }: { name: string; total: number }) {
    return (
        <div className="flex items-baseline justify-between px-6 pt-7 pb-3">
            <span className="font-alte text-[15px] tracking-[-0.01em] text-neutral-900">
                {name}
            </span>
            <span className="font-reformat text-[9px] tracking-[0.14em] text-neutral-400 uppercase">
                {total} item{total !== 1 ? 's' : ''}
            </span>
        </div>
    )
}

function Checkbox({ checked }: { checked: boolean }) {
    return (
        <span
            className="flex-shrink-0 flex items-center justify-center transition-colors"
            style={{
                width: 18,
                height: 18,
                borderRadius: 4,
                backgroundColor: checked ? '#1a1a1a' : 'transparent',
                border: checked ? 'none' : '1.5px solid #d4d4d4',
            }}
        >
            {checked && (
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M1.5 5L4 7.5L8.5 2.5" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            )}
        </span>
    )
}

function GreenCheckBadge() {
    return (
        <motion.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 380, damping: 20 }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
        >
            <span
                className="flex items-center justify-center rounded-full"
                style={{
                    width: 28,
                    height: 28,
                    backgroundColor: '#22c55e',
                    boxShadow: '0 2px 8px rgba(34,197,94,0.35)',
                }}
            >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M2.5 7L5.5 10L11.5 4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            </span>
        </motion.div>
    )
}

// ── Picking item card ──────────────────────────────────────────────────────────
// Tap = confirm pick. Long-press = report the item missing (opens the
// unavailable flow). A firing long-press suppresses the tap so a report
// never doubles as a pick.

function PickCard({
    row,
    picked,
    isMissing,
    onPick,
    onMissing,
}: {
    row: PickingRow
    picked: boolean
    isMissing: boolean
    onPick?: () => void
    onMissing?: () => void
}) {
    const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
    const longFired = useRef(false)

    function clearTimer() {
        if (pressTimer.current) {
            clearTimeout(pressTimer.current)
            pressTimer.current = null
        }
    }

    function handleDown() {
        if (isMissing || !onMissing) return
        longFired.current = false
        pressTimer.current = setTimeout(() => {
            longFired.current = true
            if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(25)
            onMissing()
        }, 450)
    }

    function handleUp() {
        clearTimer()
        if (!longFired.current && !isMissing) onPick?.()
    }

    return (
        <button
            type="button"
            onPointerDown={handleDown}
            onPointerUp={handleUp}
            onPointerLeave={clearTimer}
            onPointerCancel={clearTimer}
            onContextMenu={e => e.preventDefault()}
            disabled={isMissing || (!onPick && !onMissing)}
            className="relative w-full h-[86px] rounded-[10px] overflow-hidden text-left select-none transition-opacity active:opacity-80"
            style={{
                backgroundColor: 'rgba(217,217,217,0.28)',
                opacity: picked ? 0.45 : 1,
                touchAction: 'pan-y',
                WebkitTouchCallout: 'none',
            }}
        >
            {isMissing && <div className="absolute inset-0 bg-red-500/15 pointer-events-none" />}

            {/* Top row: code · QTY · Size — pinned to the top of the card
                (Figma 1862:1165), independent of the photo below. */}
            <div className="absolute inset-x-4 top-[12px] grid grid-cols-3 items-center gap-2 font-alte font-bold text-[12px] text-black">
                <span className={`min-w-0 truncate ${isMissing ? 'line-through decoration-red-400/70' : ''}`}>
                    {row.productName}
                </span>
                <span className="text-center tabular-nums">QTY: {row.quantity}</span>
                <span className="text-right uppercase">Size: {row.size}</span>
            </div>

            {/* Centered product photo — pinned to the bottom of the card. */}
            <div className="absolute left-1/2 -translate-x-1/2 bottom-[8px] w-[40px] h-[44px]">
                {row.cartPhoto && (
                    <Image
                        src={row.cartPhoto}
                        alt=""
                        fill
                        className="object-contain"
                        sizes="40px"
                    />
                )}
                {picked && <GreenCheckBadge />}
            </div>
        </button>
    )
}

// ── Main component ────────────────────────────────────────────────────────────

export function RoomOverviewSheet({
    open,
    orders,
    selectedIds,
    onToggleOrder,
    tasks,
    taskStatuses,
    pickedDetails,
    missingDetails,
    onTogglePickedDetail,
    onApplyUnavailable,
    onClose,
    onDone,
}: {
    open: boolean
    orders: FlowOrder[]
    selectedIds?: Set<string>
    onToggleOrder?: (id: string) => void
    tasks?: PickTask[]
    taskStatuses?: Record<number, TaskStatus>
    pickedDetails?: Set<string>
    missingDetails?: Set<string>
    onTogglePickedDetail?: (taskIndex: number, detailIndex: number) => void
    onApplyUnavailable?: (taskIndex: number, missingDetailIndices: number[], cancelledOrderIds: string[]) => void
    onClose: () => void
    onDone?: () => void
}) {
    const pickingMode = !!tasks && !!pickedDetails

    const [queueModeTab, setQueueModeTab] = useState<GroupMode>('order')
    const [missingTaskIndex, setMissingTaskIndex] = useState<number | null>(null)

    // Queue-mode data
    const orderRooms = useMemo(() => buildRoomOrderGroups(orders), [orders])
    const locationRooms = useMemo(() => buildRoomLocationGroups(orders), [orders])

    // Picking-mode data
    const pickingRows = useMemo(
        () => (pickingMode ? buildPickingRows(tasks!, orders) : []),
        [pickingMode, tasks, orders]
    )
    const orderGroups = useMemo(() => buildOrderGroups(pickingRows), [pickingRows])

    // When there's no real warehouse-location data, every item ends up in
    // the single "General" bucket — in that case suppress the room headers
    // so the overview reads as a flat list instead of pretend grouping.
    const hideRoomHeaders =
        (orderRooms.length <= 1) &&
        (locationRooms.length <= 1)

    // ── Footer/header counts ──
    const selectableSelection = !!onToggleOrder && !!selectedIds

    const queueTotals = useMemo(() => {
        let selectedItems = 0
        let selectedOrders = 0
        for (const o of orders) {
            const sel = !selectedIds || selectedIds.has(o.id)
            if (sel) {
                selectedOrders += 1
                selectedItems += o.items.reduce((s, i) => s + i.quantity, 0)
            }
        }
        return { selectedItems, selectedOrders, totalOrders: orders.length }
    }, [orders, selectedIds])

    const pickingTotals = useMemo(() => {
        if (!pickingMode) return { picked: 0, total: 0 }
        let total = 0
        let picked = 0
        tasks!.forEach((task, taskIndex) => {
            task.details.forEach((detail, detailIndex) => {
                if (missingDetails?.has(detailKey(taskIndex, detailIndex))) return
                total += detail.quantity
                if (pickedDetails!.has(detailKey(taskIndex, detailIndex))) {
                    picked += detail.quantity
                }
            })
        })
        return { picked, total }
    }, [pickingMode, tasks, missingDetails, pickedDetails])

    const allResolved = useMemo(() => {
        if (!pickingMode || !tasks) return false
        return tasks.every((task, taskIndex) =>
            task.details.every((_, detailIndex) => {
                const k = detailKey(taskIndex, detailIndex)
                return missingDetails?.has(k) || pickedDetails!.has(k)
            })
        )
    }, [pickingMode, tasks, missingDetails, pickedDetails])

    const isOrderSelected = (id: string) => !selectableSelection || selectedIds!.has(id)

    const pickBatchDot = useMemo(() => mostUrgentColor(orders), [orders])

    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    key="overview-fullscreen"
                    className={`fixed inset-0 z-[71] flex flex-col ${pickingMode ? 'bg-white' : 'bg-[#f4f4f2]'}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.18 }}
                >
                    {/* ── Header ── */}
                    {pickingMode ? (
                        <div className="flex-shrink-0 bg-white relative pt-[54px] pb-4 px-5">
                            <AdminNav active="pick" variant="top-left" mobileLabel="Pick" pickUrgency={pickBatchDot} />
                            <div className="lg:hidden fixed top-[13px] right-4 z-[300] flex items-center gap-[7px]">
                                <span
                                    className="rounded-full flex-shrink-0"
                                    style={{ display: 'inline-block', width: 8, height: 8, backgroundColor: pickBatchDot }}
                                />
                                <span className="text-[11px] font-bold tracking-[0.09em] opacity-70">
                                    {orderGroups.length} Order{orderGroups.length !== 1 ? 's' : ''} to Ship
                                </span>
                            </div>
                            <p className="text-left text-[12px] font-bold text-black tracking-[-0.01em] pt-[80px] leading-[1.5]">
                                Tap to confirm pick.
                                <br />
                                Long press on item if missing.
                            </p>
                        </div>
                    ) : (
                        <div className="flex-shrink-0 bg-white px-5 pt-8 pb-5">
                            <div className="flex items-baseline gap-[14px] mb-5">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="font-alte text-[53px] leading-none tracking-[-0.03em] text-black opacity-[0.18] active:opacity-40 transition-opacity"
                                >
                                    Queue
                                </button>
                                <span className="font-alte text-[53px] leading-none tracking-[-0.03em] text-black">
                                    Overview
                                </span>
                            </div>

                            <div className="flex gap-[8px]">
                                <button
                                    onClick={() => setQueueModeTab('order')}
                                    className="px-[12px] py-[7px] text-[9px] font-bold tracking-[0.12em] uppercase transition-colors rounded-full"
                                    style={{
                                        backgroundColor: queueModeTab === 'order' ? '#1a1a1a' : 'transparent',
                                        color: queueModeTab === 'order' ? '#ffffff' : '#999999',
                                        border: queueModeTab === 'order' ? 'none' : '1px solid #e0e0e0',
                                    }}
                                >
                                    By Order
                                </button>
                                <button
                                    onClick={() => setQueueModeTab('location')}
                                    className="px-[12px] py-[7px] text-[9px] font-bold tracking-[0.12em] uppercase transition-colors rounded-full"
                                    style={{
                                        backgroundColor: queueModeTab === 'location' ? '#1a1a1a' : 'transparent',
                                        color: queueModeTab === 'location' ? '#ffffff' : '#999999',
                                        border: queueModeTab === 'location' ? 'none' : '1px solid #e0e0e0',
                                    }}
                                >
                                    By Location
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ── Content ── */}
                    <div className="flex-1 overflow-y-auto scrollbar-hide pb-4">
                        {pickingMode ? (
                            <motion.div
                                key="picking-order"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ duration: 0.18 }}
                                className="px-4"
                            >
                                {orderGroups.length === 0 ? (
                                    <p className="px-2 py-8 text-[11px] text-neutral-400 font-reformat tracking-[0.08em]">
                                        No orders
                                    </p>
                                ) : orderGroups.map(g => (
                                    <div key={g.orderId}>
                                        <div className="flex items-center gap-[7px] px-1 pt-6 pb-3">
                                            <span
                                                className="rounded-full flex-shrink-0"
                                                style={{ display: 'inline-block', width: 8, height: 8, backgroundColor: urgencyColor(g.createdAt) }}
                                            />
                                            <span className="font-reformat text-[9px] font-bold tracking-[0.12em] uppercase text-black">
                                                O-{g.orderLabel}
                                            </span>
                                        </div>
                                        <div className="flex flex-col gap-[8px]">
                                            {g.rows.map((row, ri) => {
                                                const picked = pickedDetails!.has(detailKey(row.taskIndex, row.detailIndex))
                                                const isMissing = !!missingDetails?.has(detailKey(row.taskIndex, row.detailIndex))
                                                return (
                                                    <PickCard
                                                        key={`${row.taskIndex}-${row.detailIndex}-${ri}`}
                                                        row={row}
                                                        picked={picked}
                                                        isMissing={isMissing}
                                                        onPick={onTogglePickedDetail && !isMissing ? () => onTogglePickedDetail(row.taskIndex, row.detailIndex) : undefined}
                                                        onMissing={onApplyUnavailable && !isMissing ? () => setMissingTaskIndex(row.taskIndex) : undefined}
                                                    />
                                                )
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </motion.div>
                        ) : (
                            <AnimatePresence mode="wait">
                                {queueModeTab === 'order' ? (
                                    <motion.div
                                        key="order-view"
                                        initial={{ opacity: 0, x: 8 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -8 }}
                                        transition={{ duration: 0.18 }}
                                    >
                                        {orderRooms.length === 0 ? (
                                            <p className="px-6 py-8 text-[11px] text-neutral-400 font-reformat tracking-[0.08em]">
                                                No orders selected
                                            </p>
                                        ) : orderRooms.map(roomGroup => (
                                            <div key={roomGroup.room}>
                                                {!hideRoomHeaders && <RoomHeader name={roomGroup.room} total={roomGroup.roomTotal} />}
                                                <div className={`flex flex-col gap-[6px] px-4 ${hideRoomHeaders ? 'pt-5' : ''}`}>
                                                    {roomGroup.orders.map(order => {
                                                        const sel = isOrderSelected(order.orderId)
                                                        const Tag: 'button' | 'div' = selectableSelection ? 'button' : 'div'
                                                        return (
                                                            <Tag
                                                                key={order.orderId}
                                                                onClick={selectableSelection ? () => onToggleOrder!(order.orderId) : undefined}
                                                                className={`bg-white text-left transition-opacity ${selectableSelection ? 'active:opacity-60' : ''}`}
                                                                style={{ opacity: sel ? 1 : 0.4 }}
                                                            >
                                                                <div className="flex items-center gap-[10px] px-5 py-[12px] border-b border-[#f5f5f5]">
                                                                    {selectableSelection && <Checkbox checked={sel} />}
                                                                    <span
                                                                        className="rounded-full flex-shrink-0"
                                                                        style={{ display: 'inline-block', width: 7, height: 7, backgroundColor: urgencyColor(order.createdAt) }}
                                                                    />
                                                                    <span className="font-alte text-[14px] tracking-[-0.01em] leading-none">
                                                                        O-{order.orderLabel}
                                                                    </span>
                                                                    <span className="font-reformat text-[9px] text-neutral-400 tracking-[0.1em] ml-auto uppercase">
                                                                        {order.items.reduce((s, i) => s + i.quantity, 0)} item{order.items.reduce((s, i) => s + i.quantity, 0) !== 1 ? 's' : ''}
                                                                    </span>
                                                                </div>
                                                                <div className="flex flex-col divide-y divide-[#f8f8f8]">
                                                                    {order.items.map((item, idx) => (
                                                                        <div key={idx} className="flex items-center justify-between px-5 py-[9px]">
                                                                            <div className="flex flex-col gap-[3px] flex-1 min-w-0 pr-3">
                                                                                <span className="font-alte text-[12px] leading-none truncate">
                                                                                    {item.productName}
                                                                                </span>
                                                                                {item.color && (
                                                                                    <span className="font-reformat text-[9px] text-neutral-400 tracking-[0.08em] uppercase">
                                                                                        {item.color}
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                            <div className="flex items-center gap-[10px] flex-shrink-0">
                                                                                <span className="font-reformat text-[10px] text-neutral-500 tracking-[0.06em]">
                                                                                    {item.size}
                                                                                </span>
                                                                                <span className="font-reformat text-[11px] font-bold tracking-[-0.01em] tabular-nums">
                                                                                    ×{item.quantity}
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </Tag>
                                                        )
                                                    })}
                                                </div>
                                            </div>
                                        ))}
                                    </motion.div>
                                ) : (
                                    <motion.div
                                        key="location-view"
                                        initial={{ opacity: 0, x: 8 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -8 }}
                                        transition={{ duration: 0.18 }}
                                    >
                                        {locationRooms.length === 0 ? (
                                            <p className="px-6 py-8 text-[11px] text-neutral-400 font-reformat tracking-[0.08em]">
                                                No items
                                            </p>
                                        ) : locationRooms.map(roomGroup => (
                                            <div key={roomGroup.room}>
                                                {!hideRoomHeaders && <RoomHeader name={roomGroup.room} total={roomGroup.roomTotal} />}
                                                <div className={`flex flex-col gap-[6px] px-4 ${hideRoomHeaders ? 'pt-5' : ''}`}>
                                                    {roomGroup.products.map(product => (
                                                        <div key={product.key} className="bg-white">
                                                            <div className="flex items-center gap-[10px] px-5 py-[12px] border-b border-[#f5f5f5]">
                                                                <div className="flex flex-col gap-[3px] flex-1 min-w-0">
                                                                    <span className="font-alte text-[13px] tracking-[-0.01em] leading-none truncate">
                                                                        {product.productName}
                                                                    </span>
                                                                    {product.color && (
                                                                        <span className="font-reformat text-[9px] text-neutral-400 tracking-[0.08em] uppercase">
                                                                            {product.color}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <span className="font-reformat text-[12px] font-bold tracking-[-0.01em] flex-shrink-0 tabular-nums">
                                                                    ×{product.totalQty}
                                                                </span>
                                                            </div>
                                                            <div className="flex flex-col divide-y divide-[#f8f8f8]">
                                                                {product.orders.map((o, oi) => {
                                                                    const sel = isOrderSelected(o.orderId)
                                                                    const Tag: 'button' | 'div' = selectableSelection ? 'button' : 'div'
                                                                    return (
                                                                        <Tag
                                                                            key={`${o.orderId}-${o.size}-${oi}`}
                                                                            onClick={selectableSelection ? () => onToggleOrder!(o.orderId) : undefined}
                                                                            className={`flex items-center justify-between px-5 py-[9px] text-left w-full transition-opacity ${selectableSelection ? 'active:opacity-60' : ''}`}
                                                                            style={{ opacity: sel ? 1 : 0.4 }}
                                                                        >
                                                                            <div className="flex items-center gap-[8px]">
                                                                                {selectableSelection && <Checkbox checked={sel} />}
                                                                                <span
                                                                                    className="rounded-full flex-shrink-0"
                                                                                    style={{ display: 'inline-block', width: 6, height: 6, backgroundColor: urgencyColor(o.createdAt) }}
                                                                                />
                                                                                <span className="font-reformat text-[10px] tracking-[0.08em] font-bold">
                                                                                    O-{o.orderLabel}
                                                                                </span>
                                                                            </div>
                                                                            <div className="flex items-center gap-[10px]">
                                                                                <span className="font-reformat text-[10px] text-neutral-500 tracking-[0.06em]">
                                                                                    {o.size}
                                                                                </span>
                                                                                <span className="font-reformat text-[11px] font-bold tracking-[-0.01em] tabular-nums">
                                                                                    ×{o.quantity}
                                                                                </span>
                                                                            </div>
                                                                        </Tag>
                                                                    )
                                                                })}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        )}
                    </div>

                    {/* ── Sticky footer ── */}
                    <div className="flex-shrink-0 bg-white px-6 py-5 flex items-center justify-between border-t border-[#ececec]">
                        {pickingMode ? (
                            <>
                                <motion.span
                                    animate={{ opacity: allResolved ? 0.32 : 0.55 }}
                                    transition={{ duration: 0.22 }}
                                    className="font-alte text-[24px] tracking-[-0.03em] leading-none tabular-nums"
                                >
                                    {pickingTotals.picked}/{pickingTotals.total} items
                                </motion.span>
                                <AnimatePresence mode="wait" initial={false}>
                                    {allResolved && onDone ? (
                                        <motion.button
                                            key="continue"
                                            onClick={onDone}
                                            initial={{ opacity: 0, x: 8 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: 8 }}
                                            transition={{ duration: 0.22 }}
                                            className="text-[15px] font-semibold tracking-tight flex items-center gap-1 text-black"
                                        >
                                            Continue to shipping
                                            <span className="text-[16px] leading-none">→</span>
                                        </motion.button>
                                    ) : (
                                        <motion.div key="spacer" className="w-0" />
                                    )}
                                </AnimatePresence>
                            </>
                        ) : (
                            <>
                                <div className="flex flex-col gap-[3px]">
                                    <span className="font-reformat text-[9px] tracking-[0.14em] text-neutral-400 uppercase">
                                        {selectableSelection
                                            ? `${queueTotals.selectedOrders} of ${queueTotals.totalOrders} order${queueTotals.totalOrders !== 1 ? 's' : ''}`
                                            : 'Total items'}
                                    </span>
                                    <span className="font-alte text-[22px] tracking-[-0.025em] leading-none tabular-nums">
                                        {queueTotals.selectedItems} item{queueTotals.selectedItems !== 1 ? 's' : ''}
                                    </span>
                                </div>
                                <button
                                    onClick={onClose}
                                    className="px-[18px] py-[10px] bg-[#1a1a1a] text-white font-reformat text-[10px] font-bold tracking-[0.14em] uppercase rounded-full"
                                >
                                    Done
                                </button>
                            </>
                        )}
                    </div>

                    {/* ── Missing-item modal triggered from item card ── */}
                    {missingTaskIndex !== null && tasks?.[missingTaskIndex] && (() => {
                        const t = tasks[missingTaskIndex]
                        const ti = missingTaskIndex
                        const alreadyMissing = new Set(
                            t.details
                                .map((_, di) => di)
                                .filter(di => missingDetails?.has(detailKey(ti, di)))
                        )
                        const remaining = t.details.length - alreadyMissing.size
                        const apply = (missing: number[], cancelled: string[]) => {
                            onApplyUnavailable?.(ti, missing, cancelled)
                            setMissingTaskIndex(null)
                        }
                        return remaining > 1 ? (
                            <MultiOrderUnavailableSheet
                                task={t}
                                alreadyMissingIndices={alreadyMissing}
                                onClose={() => setMissingTaskIndex(null)}
                                onApplied={apply}
                            />
                        ) : (
                            <ItemUnavailableSheet
                                task={t}
                                alreadyMissingIndices={alreadyMissing}
                                onClose={() => setMissingTaskIndex(null)}
                                onApplied={apply}
                            />
                        )
                    })()}
                </motion.div>
            )}
        </AnimatePresence>
    )
}
