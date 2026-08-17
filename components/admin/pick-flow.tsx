'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion'
import { markOrderShipped, partialRefundItem, cancelOrder } from '@/app/admin/pick/actions'
import { RoomOverviewSheet } from './room-overview-sheet'
import { AdminNav } from './admin-nav'

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
    // Per-detail state: key = `${taskIndex}__${detailIndex}`. Each task detail
    // (one order's line in a shared SKU pull) tracks two flags independently
    // so we can express "Order A got it, Order B didn't" within a single task.
    const [pickedDetails, setPickedDetails] = useState<Set<string>>(new Set())
    const [missingDetails, setMissingDetails] = useState<Set<string>>(new Set())
    const [shipOrders, setShipOrders] = useState<ShipOrder[]>([])
    const [shipIndex, setShipIndex] = useState(0)
    const [showOverview, setShowOverview] = useState(false)
    const [runOrders, setRunOrders] = useState<FlowOrder[]>([])
    const [navOpen, setNavOpen] = useState(false)

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
        setPickedDetails(new Set())
        setMissingDetails(new Set())
        setShipIndex(0)
        setPhase('calculating')
    }

    const detailKey = (ti: number, di: number) => `${ti}__${di}`

    // A task is fully picked when every detail that's NOT marked missing has
    // been checked off. If every detail is missing, the task is "missing,"
    // not "picked."
    function isTaskFullyPicked(
        ti: number,
        taskList: PickTask[] = tasks,
        picked: Set<string> = pickedDetails,
        missing: Set<string> = missingDetails,
    ): boolean {
        const t = taskList[ti]
        if (!t || t.details.length === 0) return false
        let pickable = 0
        let pickedCount = 0
        for (let di = 0; di < t.details.length; di++) {
            const k = detailKey(ti, di)
            if (missing.has(k)) continue
            pickable++
            if (picked.has(k)) pickedCount++
        }
        if (pickable === 0) return false
        return pickedCount === pickable
    }

    function isTaskFullyMissing(
        ti: number,
        taskList: PickTask[] = tasks,
        missing: Set<string> = missingDetails,
    ): boolean {
        const t = taskList[ti]
        if (!t || t.details.length === 0) return false
        return t.details.every((_, di) => missing.has(detailKey(ti, di)))
    }

    // Per-row unavailable: mark a subset of details missing and (optionally)
    // drop cancelled orders from the shipping queue. Picked state is cleared
    // for any newly-missing detail.
    function applyUnavailable(
        taskIndex: number,
        missingDetailIndices: number[],
        cancelledOrderIds: string[],
    ) {
        if (missingDetailIndices.length > 0) {
            setMissingDetails(prev => {
                const next = new Set(prev)
                for (const di of missingDetailIndices) next.add(detailKey(taskIndex, di))
                return next
            })
            setPickedDetails(prev => {
                const next = new Set(prev)
                for (const di of missingDetailIndices) next.delete(detailKey(taskIndex, di))
                return next
            })
        }
        if (cancelledOrderIds.length > 0) {
            setShipOrders(prev => prev.filter(o => !cancelledOrderIds.includes(o.id)))
        }
    }

    function togglePickedDetail(taskIndex: number, detailIndex: number) {
        // Missing details can't be toggled to picked — they were resolved
        // through the unavailable flow.
        if (missingDetails.has(detailKey(taskIndex, detailIndex))) return
        setPickedDetails(prev => {
            const key = detailKey(taskIndex, detailIndex)
            const next = new Set(prev)
            if (next.has(key)) next.delete(key)
            else next.add(key)
            return next
        })
    }

    // Derived view of task-level status, passed to the overview for the
    // missing/picked decoration. 'missing' here means EVERY detail of the
    // task was marked unavailable.
    const taskStatusesDerived: Record<number, TaskStatus> = (() => {
        const out: Record<number, TaskStatus> = {}
        tasks.forEach((_, i) => {
            if (isTaskFullyMissing(i)) out[i] = 'missing'
            else if (isTaskFullyPicked(i)) out[i] = 'picked'
        })
        return out
    })()

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
                        className="fixed inset-0 flex flex-col bg-[#f3f3f3] md:items-center"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.18 }}
                    >
                        <div className="lg:hidden fixed top-0 left-0 right-0 h-[39px] bg-white z-[290]" />
                        <AdminNav active="pick" variant="top-left" mobileLabel="Pick" pickUrgency={batchDotColor} onMobileHubOpenChange={setNavOpen} />
                        {orders.length > 0 && navOpen && (
                            <div className="lg:hidden fixed top-[13px] right-4 z-[300] flex items-center gap-[7px]">
                                <span
                                    className="rounded-full flex-shrink-0"
                                    style={{ display: 'inline-block', width: 8, height: 8, backgroundColor: batchDotColor }}
                                />
                                <span className="text-[11px] font-bold tracking-[0.09em] opacity-70">
                                    {orders.length} Orders to Ship
                                </span>
                            </div>
                        )}
                        <div className="flex flex-col bg-[#f3f3f3] w-full h-full md:max-w-screen-sm md:border md:border-black">
                            {orders.length === 0 ? (
                                <div className="flex-1 flex flex-col items-center justify-center px-8 gap-6">
                                    <span className="font-alte text-[36px] tracking-[-0.03em] leading-none opacity-20">Pick Session</span>
                                    <span className="text-[13px] font-medium text-neutral-400 text-center leading-relaxed">
                                        No orders waiting to ship.
                                    </span>
                                </div>
                            ) : (
                            <>
                            <div className="flex-1 overflow-y-auto">
                                <div className="flex items-center justify-center gap-[7px] pt-24 pb-8">
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
                                    <span className="text-[10px] tracking-[0.12em] bg-white px-[10px] py-[7px]">
                                        {selectedIds.size} / {orders.length} selected
                                    </span>
                                </div>

                                <div className="flex flex-col gap-[10px] px-5 pt-5">
                                    <button
                                        onClick={() => setSelectedIds(new Set())}
                                        disabled={noneSelected}
                                        className="text-left text-[10px] tracking-[0.12em] uppercase disabled:opacity-30 transition-opacity w-fit"
                                    >
                                        Unselect All
                                    </button>
                                    <button
                                        onClick={() => setSelectedIds(new Set(orders.map(o => o.id)))}
                                        disabled={allSelected}
                                        className="text-left text-[10px] tracking-[0.12em] uppercase disabled:opacity-30 transition-opacity w-fit"
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
                    <CalculatingBody onContinue={() => {
                        setPhase('picking')
                        setShowOverview(true)
                    }} />
                </motion.div>
            )}

            {/* Picking phase has no standalone view — the Overview sheet (rendered
                below, auto-opened from the calculating step) is the working surface
                for the session. */}

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
                                        setShowOverview(true)
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
                                                <span className="text-[9px] text-neutral-500 tracking-[0.1em] uppercase flex-shrink-0">
                                                    {item.color}
                                                </span>
                                            )}
                                            <span className="text-[9px] text-neutral-500 tracking-[0.1em] uppercase flex-shrink-0">
                                                S:{item.size}
                                            </span>
                                            {item.quantity > 1 && (
                                                <span className="text-[10px] font-bold tracking-[-0.01em] tabular-nums flex-shrink-0">
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

            {/* ── Room Overview Sheet ── */}
            <RoomOverviewSheet
                open={showOverview}
                orders={phase === 'queue' ? orders : runOrders}
                selectedIds={phase === 'queue' ? selectedIds : undefined}
                onToggleOrder={phase === 'queue' ? toggleOrder : undefined}
                tasks={phase !== 'queue' ? tasks : undefined}
                taskStatuses={phase !== 'queue' ? taskStatusesDerived : undefined}
                pickedDetails={phase !== 'queue' ? pickedDetails : undefined}
                missingDetails={phase !== 'queue' ? missingDetails : undefined}
                onTogglePickedDetail={phase !== 'queue' ? togglePickedDetail : undefined}
                onApplyUnavailable={phase !== 'queue' ? applyUnavailable : undefined}
                onClose={() => {
                    setShowOverview(false)
                    // In picking phase the overview IS the screen — closing it
                    // means the user wants to revise their selection.
                    if (phase === 'picking') setPhase('queue')
                }}
                onDone={phase !== 'queue' ? () => {
                    setShowOverview(false)
                    if (shipOrders.length === 0) router.push('/admin/orders')
                    else setPhase('shipping')
                } : undefined}
            />

        </LayoutGroup>
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

export function ItemUnavailableSheet({
    task,
    alreadyMissingIndices,
    onClose,
    onApplied,
}: {
    task: PickTask
    alreadyMissingIndices?: Set<number>
    onClose: () => void
    onApplied: (missingDetailIndices: number[], cancelledOrderIds: string[]) => void
}) {
    const [loading, setLoading] = useState<string | null>(null)
    const [refundStep, setRefundStep] = useState<string>('Partial Refund')
    // Pick the first still-pickable detail as the "primary." For a single-
    // order task this is just details[0]; for multi-order callers that
    // routed here because only one row remains, we want that row.
    const primaryIndex = task.details.findIndex((_, i) => !alreadyMissingIndices?.has(i))
    const primary = task.details[primaryIndex >= 0 ? primaryIndex : 0]

    const emailBody = encodeURIComponent(
        `Hi,\n\nWe're sorry, but we were unable to fulfill the following item from your order:\n\n` +
        `${task.productName} — Size ${primary.size} × ${primary.quantity}\n\n` +
        `We'll be in touch shortly regarding your options.\n\nThank you for your patience.`
    )
    const mailtoHref = `mailto:${primary.email}?subject=${encodeURIComponent(`Update on your order #${primary.orderLabel}`)}&body=${emailBody}`

    const primaryDi = primaryIndex >= 0 ? primaryIndex : 0

    async function handlePartialRefund() {
        setLoading('refund')
        try {
            setRefundStep('Contacting Stripe...')
            await partialRefundItem(primary.orderId, Math.round(primary.price * primary.quantity * 100))
            setRefundStep('Verifying refund...')
            await new Promise(resolve => setTimeout(resolve, 500))
            setRefundStep('Refund complete')
            await new Promise(resolve => setTimeout(resolve, 400))
            onApplied([primaryDi], [])
        } finally { setLoading(null) }
    }

    async function handleCancelOrder() {
        setLoading('cancel')
        try {
            await cancelOrder(primary.orderId)
            onApplied([primaryDi], [primary.orderId])
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

// ── Multi-order unavailable sheet ────────────────────────────────────────────
// When a single SKU pull serves multiple orders, the picker has to decide
// per-order what to do (the floor reality: maybe we have 2 of 3, so 1 order
// gets nothing). Each row has its own action; nothing fires until Confirm.

type RowAction = 'pickable' | 'refund' | 'cancel' | 'email'

export function MultiOrderUnavailableSheet({
    task,
    alreadyMissingIndices,
    onClose,
    onApplied,
}: {
    task: PickTask
    alreadyMissingIndices?: Set<number>
    onClose: () => void
    onApplied: (missingDetailIndices: number[], cancelledOrderIds: string[]) => void
}) {
    // Only show rows that haven't already been resolved through this flow,
    // so a re-open after a partial pass doesn't double-fire refunds.
    const visibleIndices = task.details
        .map((_, i) => i)
        .filter(i => !alreadyMissingIndices?.has(i))

    // Default every visible row to 'refund' — the most common path for
    // "I don't have this." Picker flips rows to 'pickable' for boxes they
    // can still fill, or 'cancel' for orders worth cancelling outright.
    const [actions, setActions] = useState<Record<number, RowAction>>(() => {
        const init: Record<number, RowAction> = {}
        for (const i of visibleIndices) init[i] = 'refund'
        return init
    })
    const [loading, setLoading] = useState(false)
    const [progressText, setProgressText] = useState<string>('')

    function setRow(i: number, a: RowAction) {
        setActions(prev => ({ ...prev, [i]: a }))
    }

    async function handleConfirm() {
        setLoading(true)
        try {
            const refundIndices: number[] = []
            const cancelIndices: number[] = []
            for (const i of visibleIndices) {
                const a = actions[i]
                if (a === 'refund') refundIndices.push(i)
                else if (a === 'cancel') cancelIndices.push(i)
            }

            if (refundIndices.length > 0) {
                setProgressText('Issuing refunds...')
                await Promise.all(refundIndices.map(i => {
                    const d = task.details[i]
                    return partialRefundItem(d.orderId, Math.round(d.price * d.quantity * 100))
                }))
            }
            if (cancelIndices.length > 0) {
                setProgressText('Cancelling orders...')
                await Promise.all(cancelIndices.map(i => cancelOrder(task.details[i].orderId)))
            }

            const missingIndices: number[] = [...refundIndices, ...cancelIndices]
            const cancelledOrderIds = cancelIndices.map(i => task.details[i].orderId)

            onApplied(missingIndices, cancelledOrderIds)
        } finally {
            setLoading(false)
            setProgressText('')
        }
    }

    const anyActionable = visibleIndices.some(i => actions[i] !== 'pickable')

    return (
        <div className="fixed inset-0 z-50 flex items-end bg-black/20" onClick={onClose}>
            <div className="w-full bg-white rounded-t-[2rem] px-6 pt-6 pb-8 max-h-[calc(88*var(--vh))] flex flex-col" onClick={e => e.stopPropagation()}>
                <p className="text-[11px] font-semibold tracking-[0.12em] text-neutral-400 mb-1 text-center">ITEM UNAVAILABLE</p>
                <p className="text-[12px] text-neutral-500 text-center mb-1">{task.productName}</p>
                <p className="text-[10px] text-neutral-400 text-center mb-4">
                    {visibleIndices.length} order{visibleIndices.length !== 1 ? 's' : ''} need this — choose an action per order
                </p>

                <div className="flex-1 overflow-y-auto -mx-6 px-6 [&::-webkit-scrollbar]:hidden">
                    <div className="flex flex-col gap-2">
                        {visibleIndices.map(i => {
                            const d = task.details[i]
                            const action = actions[i]
                            const emailBody = encodeURIComponent(
                                `Hi,\n\nWe're sorry, but we were unable to fulfill the following item from your order:\n\n` +
                                `${task.productName} — Size ${d.size} × ${d.quantity}\n\n` +
                                `We'll be in touch shortly regarding your options.\n\nThank you for your patience.`
                            )
                            const mailtoHref = `mailto:${d.email}?subject=${encodeURIComponent(`Update on your order #${d.orderLabel}`)}&body=${emailBody}`
                            return (
                                <div key={`${d.orderId}-${i}`} className="rounded-2xl bg-neutral-50 px-4 py-3">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="text-[10px] font-bold tracking-[0.08em] uppercase">
                                            O-{d.orderLabel}
                                        </span>
                                        <span className="text-[9px] text-neutral-400 tracking-[0.06em] uppercase">
                                            Box #{d.boxNumber} · S:{d.size} ×{d.quantity}
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-[6px]">
                                        <ActionPill
                                            label="Refund line"
                                            active={action === 'refund'}
                                            onClick={() => setRow(i, 'refund')}
                                        />
                                        <ActionPill
                                            label="Cancel order"
                                            active={action === 'cancel'}
                                            danger
                                            onClick={() => setRow(i, 'cancel')}
                                        />
                                        <ActionPill
                                            label="Have it"
                                            active={action === 'pickable'}
                                            onClick={() => setRow(i, 'pickable')}
                                        />
                                        <a
                                            href={mailtoHref}
                                            className="text-center px-[10px] py-[8px] rounded-full text-[10px] font-bold tracking-[0.08em] uppercase bg-white border border-neutral-200 text-neutral-600 active:opacity-70"
                                        >
                                            Email
                                        </a>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>

                <div className="flex gap-2 pt-4">
                    <button
                        onClick={onClose}
                        disabled={loading}
                        className="flex-1 py-4 rounded-2xl bg-neutral-100 text-neutral-700 text-[13px] font-semibold disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={loading || !anyActionable}
                        className="flex-[2] py-4 rounded-2xl bg-neutral-900 text-white text-[13px] font-semibold disabled:opacity-40"
                    >
                        {loading ? (progressText || 'Working...') : 'Confirm'}
                    </button>
                </div>
            </div>
        </div>
    )
}

function ActionPill({
    label,
    active,
    danger = false,
    onClick,
}: {
    label: string
    active: boolean
    danger?: boolean
    onClick: () => void
}) {
    const activeBg = danger ? '#fee2e2' : '#1a1a1a'
    const activeColor = danger ? '#b91c1c' : '#ffffff'
    return (
        <button
            type="button"
            onClick={onClick}
            className="px-[10px] py-[8px] rounded-full text-[10px] font-bold tracking-[0.08em] uppercase transition-colors active:opacity-70"
            style={{
                backgroundColor: active ? activeBg : '#ffffff',
                color: active ? activeColor : '#737373',
                border: active ? 'none' : '1px solid #e5e5e5',
            }}
        >
            {label}
        </button>
    )
}
