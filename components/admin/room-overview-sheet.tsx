'use client'

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'
import type { FlowOrder, PickTask } from './pick-flow'
import { ItemUnavailableSheet, MultiOrderUnavailableSheet } from './pick-flow'

type TaskStatus = 'picked' | 'missing'

// ── Helpers ───────────────────────────────────────────────────────────────────

function urgencyColor(createdAt: Date): string {
    const days = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24)
    if (days > 7) return '#ef4444'
    if (days >= 3) return '#eab308'
    return '#3b82f6'
}

const UNASSIGNED_LABEL = 'General'

function roomLabel(loc: string | null): string {
    return loc?.trim() || UNASSIGNED_LABEL
}

function BoxIcon({ size = 14, color = 'currentColor' }: { size?: number; color?: string }) {
    return (
        <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
            <path d="M2 5L8 2L14 5L8 8L2 5Z" stroke={color} strokeWidth="1.2" strokeLinejoin="round" />
            <path d="M2 5V11L8 14V8" stroke={color} strokeWidth="1.2" strokeLinejoin="round" />
            <path d="M14 5V11L8 14" stroke={color} strokeWidth="1.2" strokeLinejoin="round" />
        </svg>
    )
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

type LocationGroup = {
    room: string
    boxes: Array<{ boxNumber: number; rows: PickingRow[] }>
    roomTotalQty: number
}

type OrderGroup = {
    orderId: string
    orderLabel: string
    boxNumber: number
    createdAt: Date
    rooms: Array<{ room: string; rows: PickingRow[] }>
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

function buildLocationGroups(rows: PickingRow[]): LocationGroup[] {
    const map = new Map<string, LocationGroup>()
    for (const row of rows) {
        const room = roomLabel(row.warehouseLocation)
        if (!map.has(room)) map.set(room, { room, boxes: [], roomTotalQty: 0 })
        const g = map.get(room)!
        g.roomTotalQty += row.quantity
        let box = g.boxes.find(b => b.boxNumber === row.boxNumber)
        if (!box) {
            box = { boxNumber: row.boxNumber, rows: [] }
            g.boxes.push(box)
        }
        box.rows.push(row)
    }
    for (const g of map.values()) {
        g.boxes.sort((a, b) => a.boxNumber - b.boxNumber)
    }
    return [...map.values()].sort((a, b) => a.room.localeCompare(b.room))
}

function buildOrderGroups(rows: PickingRow[]): OrderGroup[] {
    const map = new Map<string, OrderGroup>()
    for (const row of rows) {
        if (!map.has(row.orderId)) {
            map.set(row.orderId, {
                orderId: row.orderId,
                orderLabel: row.orderLabel,
                boxNumber: row.boxNumber,
                createdAt: row.createdAt,
                rooms: [],
                totalQty: 0,
            })
        }
        const g = map.get(row.orderId)!
        g.totalQty += row.quantity
        const room = roomLabel(row.warehouseLocation)
        let r = g.rooms.find(x => x.room === room)
        if (!r) {
            r = { room, rows: [] }
            g.rooms.push(r)
        }
        r.rows.push(row)
    }
    for (const g of map.values()) {
        g.rooms.sort((a, b) => a.room.localeCompare(b.room))
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

function OrderChip({
    orderLabel,
    boxNumber,
    color,
    itemCount,
}: {
    orderLabel: string
    boxNumber: number
    color: string
    itemCount: number
}) {
    return (
        <div className="bg-white px-[10px] py-[10px] flex flex-col items-center gap-[6px] flex-shrink-0" style={{ minWidth: 92 }}>
            <span
                className="px-[8px] py-[3px] flex items-center gap-[5px] rounded-sm"
                style={{ backgroundColor: '#f4f4f2' }}
            >
                <span
                    className="rounded-full"
                    style={{ display: 'inline-block', width: 6, height: 6, backgroundColor: color }}
                />
                <span className="font-reformat text-[9px] font-bold tracking-[0.08em]">
                    O-{orderLabel}
                </span>
            </span>
            <span className="flex items-center gap-[5px] mt-[2px]">
                <BoxIcon size={13} color="#1a1a1a" />
                <span className="font-alte text-[15px] tracking-[-0.02em] leading-none">
                    #{boxNumber}
                </span>
            </span>
            <span className="font-reformat text-[8px] tracking-[0.14em] text-neutral-400 uppercase">
                {itemCount} item{itemCount !== 1 ? 's' : ''}
            </span>
        </div>
    )
}

function ItemRow({
    row,
    picked,
    onToggle,
    onMissing,
    isMissing,
}: {
    row: PickingRow
    picked: boolean
    onToggle?: () => void
    onMissing?: () => void
    isMissing?: boolean
}) {
    return (
        <div
            className="flex items-center w-full text-left px-5 py-[10px] gap-[12px] relative"
        >
            {isMissing && (
                <div className="absolute inset-0 bg-red-500/20 pointer-events-none" />
            )}
            <button
                type="button"
                onClick={onToggle}
                disabled={!onToggle}
                className={`flex items-center flex-1 min-w-0 gap-[12px] text-left transition-opacity ${onToggle ? 'active:opacity-70' : ''}`}
                style={{ opacity: picked ? 0.4 : 1 }}
            >
                <div className="relative flex-shrink-0" style={{ width: 36, height: 40 }}>
                    {row.cartPhoto ? (
                        <Image
                            src={row.cartPhoto}
                            alt=""
                            fill
                            className="object-contain"
                            sizes="36px"
                        />
                    ) : (
                        <div className="w-full h-full" />
                    )}
                    {picked && <GreenCheckBadge />}
                </div>
                <span className="font-alte text-[12px] leading-none truncate flex-1 min-w-0">
                    {row.productName}
                </span>
                {row.color && (
                    <span className="font-reformat text-[9px] text-neutral-500 tracking-[0.1em] uppercase flex-shrink-0">
                        {row.color}
                    </span>
                )}
                <span className="font-reformat text-[9px] text-neutral-500 tracking-[0.1em] uppercase flex-shrink-0">
                    S:{row.size}
                </span>
                {row.quantity > 1 && (
                    <span className="font-reformat text-[10px] font-bold tracking-[-0.01em] tabular-nums flex-shrink-0">
                        ×{row.quantity}
                    </span>
                )}
            </button>
            {onMissing && (
                <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onMissing() }}
                    className="flex-shrink-0 text-[9px] text-neutral-400 font-medium tracking-[0.06em] uppercase active:text-neutral-700 transition-colors px-1"
                    aria-label="Mark item as missing"
                >
                    missing?
                </button>
            )}
        </div>
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
    const [pickingTab, setPickingTab] = useState<GroupMode>('location')
    const [missingTaskIndex, setMissingTaskIndex] = useState<number | null>(null)

    // Queue-mode data
    const orderRooms = useMemo(() => buildRoomOrderGroups(orders), [orders])
    const locationRooms = useMemo(() => buildRoomLocationGroups(orders), [orders])

    // Picking-mode data
    const pickingRows = useMemo(
        () => (pickingMode ? buildPickingRows(tasks!, orders) : []),
        [pickingMode, tasks, orders]
    )
    const locationGroups = useMemo(() => buildLocationGroups(pickingRows), [pickingRows])
    const orderGroups = useMemo(() => buildOrderGroups(pickingRows), [pickingRows])

    // When there's no real warehouse-location data, every item ends up in
    // the single "General" bucket — in that case suppress the room headers
    // so the overview reads as a flat list instead of pretend grouping.
    const hideRoomHeaders =
        (orderRooms.length <= 1) &&
        (locationRooms.length <= 1) &&
        (locationGroups.length <= 1)

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

    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    key="overview-fullscreen"
                    className="fixed inset-0 z-[71] bg-[#f4f4f2] flex flex-col"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.18 }}
                >
                    {/* ── Header ── */}
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

                        {pickingMode && orderGroups.length > 0 && (
                            <div className="flex gap-[6px] overflow-x-auto scrollbar-hide -mx-5 px-5 pb-1">
                                {orderGroups.map(g => (
                                    <OrderChip
                                        key={g.orderId}
                                        orderLabel={g.orderLabel}
                                        boxNumber={g.boxNumber}
                                        color={urgencyColor(g.createdAt)}
                                        itemCount={g.totalQty}
                                    />
                                ))}
                            </div>
                        )}

                        <div className={`flex gap-[8px] ${pickingMode ? 'mt-4' : ''}`}>
                            {pickingMode ? (
                                <>
                                    <button
                                        onClick={() => setPickingTab('location')}
                                        className="px-[12px] py-[7px] text-[9px] font-bold tracking-[0.12em] uppercase transition-colors rounded-full"
                                        style={{
                                            backgroundColor: pickingTab === 'location' ? '#1a1a1a' : 'transparent',
                                            color: pickingTab === 'location' ? '#ffffff' : '#999999',
                                            border: pickingTab === 'location' ? 'none' : '1px solid #e0e0e0',
                                        }}
                                    >
                                        By Location
                                    </button>
                                    <button
                                        onClick={() => setPickingTab('order')}
                                        className="px-[12px] py-[7px] text-[9px] font-bold tracking-[0.12em] uppercase transition-colors rounded-full"
                                        style={{
                                            backgroundColor: pickingTab === 'order' ? '#1a1a1a' : 'transparent',
                                            color: pickingTab === 'order' ? '#ffffff' : '#999999',
                                            border: pickingTab === 'order' ? 'none' : '1px solid #e0e0e0',
                                        }}
                                    >
                                        By Order
                                    </button>
                                </>
                            ) : (
                                <>
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
                                </>
                            )}
                        </div>
                    </div>

                    {/* ── Content ── */}
                    <div className="flex-1 overflow-y-auto scrollbar-hide pb-4">
                        {pickingMode ? (
                            <AnimatePresence mode="wait">
                                {pickingTab === 'location' ? (
                                    <motion.div
                                        key="picking-location"
                                        initial={{ opacity: 0, x: 8 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -8 }}
                                        transition={{ duration: 0.18 }}
                                    >
                                        {locationGroups.length === 0 ? (
                                            <p className="px-6 py-8 text-[11px] text-neutral-400 font-reformat tracking-[0.08em]">
                                                No items
                                            </p>
                                        ) : locationGroups.map(g => (
                                            <div key={g.room}>
                                                {!hideRoomHeaders && <RoomHeader name={g.room} total={g.roomTotalQty} />}
                                                <div className={`flex flex-col gap-[6px] px-4 ${hideRoomHeaders ? 'pt-5' : ''}`}>
                                                    {g.boxes.map(box => (
                                                        <div key={box.boxNumber} className="bg-white">
                                                            <div className="flex items-center gap-[8px] px-5 py-[10px] border-b border-[#f5f5f5]">
                                                                <BoxIcon size={13} color="#1a1a1a" />
                                                                <span className="font-alte text-[13px] tracking-[-0.01em] leading-none">
                                                                    #{box.boxNumber}
                                                                </span>
                                                                <span className="font-reformat text-[9px] tracking-[0.1em] text-neutral-400 ml-auto uppercase">
                                                                    {box.rows.reduce((s, r) => s + r.quantity, 0)} item{box.rows.reduce((s, r) => s + r.quantity, 0) !== 1 ? 's' : ''}
                                                                </span>
                                                            </div>
                                                            <div className="flex flex-col divide-y divide-[#f8f8f8]">
                                                                {box.rows.map((row, ri) => {
                                                                    const picked = pickedDetails!.has(detailKey(row.taskIndex, row.detailIndex))
                                                                    const isMissing = !!missingDetails?.has(detailKey(row.taskIndex, row.detailIndex))
                                                                    return (
                                                                        <ItemRow
                                                                            key={`${row.taskIndex}-${row.detailIndex}-${ri}`}
                                                                            row={row}
                                                                            picked={picked}
                                                                            isMissing={isMissing}
                                                                            onToggle={onTogglePickedDetail && !isMissing ? () => onTogglePickedDetail(row.taskIndex, row.detailIndex) : undefined}
                                                                            onMissing={onApplyUnavailable && !isMissing ? () => setMissingTaskIndex(row.taskIndex) : undefined}
                                                                        />
                                                                    )
                                                                })}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </motion.div>
                                ) : (
                                    <motion.div
                                        key="picking-order"
                                        initial={{ opacity: 0, x: 8 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -8 }}
                                        transition={{ duration: 0.18 }}
                                    >
                                        {orderGroups.length === 0 ? (
                                            <p className="px-6 py-8 text-[11px] text-neutral-400 font-reformat tracking-[0.08em]">
                                                No orders
                                            </p>
                                        ) : orderGroups.map(g => (
                                            <div key={g.orderId}>
                                                <div className="flex items-center justify-between px-6 pt-7 pb-3 gap-2">
                                                    <span className="flex items-center gap-[8px]">
                                                        <span
                                                            className="rounded-full"
                                                            style={{ display: 'inline-block', width: 7, height: 7, backgroundColor: urgencyColor(g.createdAt) }}
                                                        />
                                                        <span className="font-alte text-[15px] tracking-[-0.01em] text-neutral-900">
                                                            O-{g.orderLabel}
                                                        </span>
                                                        <span className="flex items-center gap-[4px] ml-1 text-neutral-500">
                                                            <BoxIcon size={11} color="#737373" />
                                                            <span className="font-reformat text-[10px] tracking-[0.06em]">#{g.boxNumber}</span>
                                                        </span>
                                                    </span>
                                                    <span className="font-reformat text-[9px] tracking-[0.14em] text-neutral-400 uppercase">
                                                        {g.totalQty} item{g.totalQty !== 1 ? 's' : ''}
                                                    </span>
                                                </div>
                                                <div className="flex flex-col gap-[6px] px-4">
                                                    {g.rooms.map(r => (
                                                        <div key={r.room} className="bg-white">
                                                            {!hideRoomHeaders && (
                                                                <div className="px-5 py-[10px] border-b border-[#f5f5f5]">
                                                                    <span className="font-alte text-[12px] tracking-[-0.01em] text-neutral-700">
                                                                        {r.room}
                                                                    </span>
                                                                </div>
                                                            )}
                                                            <div className="flex flex-col divide-y divide-[#f8f8f8]">
                                                                {r.rows.map((row, ri) => {
                                                                    const picked = pickedDetails!.has(detailKey(row.taskIndex, row.detailIndex))
                                                                    const isMissing = !!missingDetails?.has(detailKey(row.taskIndex, row.detailIndex))
                                                                    return (
                                                                        <ItemRow
                                                                            key={`${row.taskIndex}-${row.detailIndex}-${ri}`}
                                                                            row={row}
                                                                            picked={picked}
                                                                            isMissing={isMissing}
                                                                            onToggle={onTogglePickedDetail && !isMissing ? () => onTogglePickedDetail(row.taskIndex, row.detailIndex) : undefined}
                                                                            onMissing={onApplyUnavailable && !isMissing ? () => setMissingTaskIndex(row.taskIndex) : undefined}
                                                                        />
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

                    {/* ── Missing-item modal triggered from item row ── */}
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
