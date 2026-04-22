'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import type { PickOrder } from '@/app/admin/pick/page'

function urgencyColor(createdAt: Date): string {
    const days = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24)
    if (days > 7) return '#ef4444'
    if (days >= 3) return '#eab308'
    return '#3b82f6'
}

function mostUrgentColor(orders: PickOrder[]): string {
    const colors = orders.map(o => urgencyColor(o.createdAt))
    if (colors.includes('#ef4444')) return '#ef4444'
    if (colors.includes('#eab308')) return '#eab308'
    return '#3b82f6'
}

function orderLabel(orderNumber: string): string {
    return orderNumber.slice(0, 3)
}

type Mode = 'batch' | 'sequential'

export function PickQueue({ orders }: { orders: PickOrder[] }) {
    const router = useRouter()
    const [selected, setSelected] = useState<Set<string>>(
        () => new Set(orders.map(o => o.id))
    )
    const [showModeModal, setShowModeModal] = useState(false)

    const allSelected = selected.size === orders.length
    const noneSelected = selected.size === 0

    function toggleOrder(id: string) {
        setSelected(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    function handleBegin(mode: Mode) {
        const ids = [...selected].join(',')
        router.push(`/admin/pick/run?orders=${ids}&mode=${mode}`)
    }

    const batchDotColor = mostUrgentColor(orders)

    return (
        <>
            {/* Full-screen layout on mobile, centered phone frame on desktop */}
            <div className="fixed inset-0 flex flex-col bg-[#e8e8e8] md:items-center md:justify-center">
                <div
                    className="flex flex-col bg-[#e8e8e8] w-full h-full md:w-[320px] md:h-[660px] md:rounded-[44px] md:overflow-hidden md:border md:border-neutral-200"
                >
                    {/* Scrollable content */}
                    <div className="flex-1 overflow-y-auto">

                        {/* Title */}
                        <div className="flex items-start justify-center pt-12 pb-10 gap-[4px]">
                            <span className="font-alte text-[36px] tracking-[-0.03em] leading-none">Pick Queue</span>
                            <span
                                className="flex-shrink-0 rounded-full bg-black flex items-center justify-center text-white font-bold leading-none select-none"
                                style={{ width: 10, height: 10, fontSize: 7, marginTop: 3 }}
                            >
                                i
                            </span>
                        </div>

                        {/* Orders to ship */}
                        <div className="flex items-center justify-center gap-[7px] pb-8">
                            <span
                                className="rounded-full flex-shrink-0"
                                style={{ display: 'inline-block', width: 8, height: 8, backgroundColor: batchDotColor }}
                            />
                            <span className="text-[11px] font-bold tracking-[0.09em] opacity-70">
                                {orders.length} Orders to Ship
                            </span>
                        </div>

                        {/* Order rows */}
                        <div className="flex flex-col gap-[18px] px-5">
                            {orders.map(order => {
                                const isSelected = selected.has(order.id)
                                return (
                                    <button
                                        key={order.id}
                                        onClick={() => toggleOrder(order.id)}
                                        className="flex items-center w-full text-left transition-opacity duration-150"
                                        style={{ opacity: isSelected ? 1 : 0.28 }}
                                    >
                                        {/* Left: urgency dot + order number pill */}
                                        <div className="flex items-center gap-[5px] bg-white rounded-[6px] px-[10px] py-[7px] flex-shrink-0">
                                            <span
                                                className="rounded-full flex-shrink-0"
                                                style={{ display: 'inline-block', width: 8, height: 8, backgroundColor: urgencyColor(order.createdAt) }}
                                            />
                                            <span className="text-[8px] font-bold tracking-[0.09em] uppercase">
                                                O-{orderLabel(order.orderNumber)}
                                            </span>
                                        </div>

                                        {/* Spacer */}
                                        <div className="flex-1" />

                                        {/* Right: cart photos + item count */}
                                        <div className="flex items-end gap-[10px] flex-shrink-0">
                                            <div className="flex items-end gap-[3px]">
                                                {order.cartPhotos.length === 0
                                                    ? <div className="w-[20px] h-[30px]" />
                                                    : order.cartPhotos.slice(0, 4).map((url, i) => (
                                                        <div key={i} className="flex-shrink-0" style={{ height: 36 }}>
                                                            <Image
                                                                src={url}
                                                                alt=""
                                                                width={40}
                                                                height={36}
                                                                className="h-full w-auto object-contain"
                                                                sizes="40px"
                                                            />
                                                        </div>
                                                    ))
                                                }
                                            </div>
                                            <span className="text-[8px] font-bold tracking-[0.09em] uppercase pb-[2px]">
                                                {order.itemCount} ITEM{order.itemCount !== 1 ? 'S' : ''}
                                            </span>
                                        </div>
                                    </button>
                                )
                            })}
                        </div>

                        {/* Counter */}
                        <div className="flex justify-end px-5 pt-6">
                            <span className="font-reformat text-[10px] tracking-[0.12em] bg-white rounded-[6px] px-[10px] py-[7px]">
                                {selected.size} / {orders.length} selected
                            </span>
                        </div>

                        {/* Select controls */}
                        <div className="flex flex-col gap-[10px] px-5 pt-5">
                            <button
                                onClick={() => setSelected(new Set())}
                                disabled={noneSelected}
                                className="text-left font-reformat text-[10px] tracking-[0.12em] uppercase disabled:opacity-30 transition-opacity w-fit"
                            >
                                Unselect All
                            </button>
                            <button
                                onClick={() => setSelected(new Set(orders.map(o => o.id)))}
                                disabled={allSelected}
                                className="text-left font-reformat text-[10px] tracking-[0.12em] uppercase disabled:opacity-30 transition-opacity w-fit"
                            >
                                Select All
                            </button>
                        </div>
                    </div>

                    {/* Begin CTA — flex-shrink-0 keeps it pinned at bottom of the flex column */}
                    <div className="flex-shrink-0 bg-white md:rounded-b-[44px]">
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
            </div>

            {/* Mode selection sheet */}
            {showModeModal && (
                <div
                    className="fixed inset-0 z-50 flex items-end justify-center bg-black/20"
                    onClick={() => setShowModeModal(false)}
                >
                    <div
                        className="w-full max-w-sm bg-white rounded-t-[2rem] px-6 pt-6 pb-12"
                        onClick={e => e.stopPropagation()}
                    >
                        <p className="text-[11px] text-neutral-400 mb-5 text-center tracking-wide">
                            {selected.size} ORDER{selected.size !== 1 ? 'S' : ''} SELECTED
                        </p>
                        <div className="flex flex-col gap-3">
                            <button
                                onClick={() => handleBegin('sequential')}
                                className="w-full py-5 rounded-2xl bg-neutral-900 text-white text-[15px] font-semibold"
                            >
                                Sequential
                                <span className="block text-[11px] font-normal text-neutral-400 mt-0.5">
                                    One order at a time
                                </span>
                            </button>
                            <button
                                onClick={() => handleBegin('batch')}
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
        </>
    )
}
