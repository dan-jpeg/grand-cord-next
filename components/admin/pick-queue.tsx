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

    return (
        <div className="min-h-screen bg-[#e8e8e8] flex items-center justify-center">
            {/* Phone frame */}
            <div
                className="relative flex flex-col bg-[#e8e8e8] rounded-[44px] overflow-hidden"
                style={{ width: 320, height: 660 }}
            >
                {/* Title */}
                <div className="flex items-start justify-center pt-12 pb-8 gap-1">
                    <span className="text-[26px] font-semibold tracking-tight leading-none">Pick Queue</span>
                    <span className="text-[11px] text-neutral-400 mt-0.5 leading-none select-none">ⓘ</span>
                </div>

                {/* Orders to ship count */}
                <div className="flex items-center gap-2 px-8 pb-5">
                    <span className="w-[7px] h-[7px] rounded-full bg-red-500 flex-shrink-0" />
                    <span className="text-[11px] font-medium">
                        {orders.length} Order{orders.length !== 1 ? 's' : ''} to Ship
                    </span>
                </div>

                {/* Order rows */}
                <div className="flex flex-col gap-[14px] px-7 flex-1">
                    {orders.map(order => {
                        const isSelected = selected.has(order.id)
                        return (
                            <button
                                key={order.id}
                                onClick={() => toggleOrder(order.id)}
                                className="flex items-center w-full text-left transition-opacity duration-150"
                                style={{ opacity: isSelected ? 1 : 0.28 }}
                            >
                                {/* Dot + order number */}
                                <div className="flex items-center gap-[5px] w-[52px] flex-shrink-0">
                                    <span
                                        className="w-[7px] h-[7px] rounded-full flex-shrink-0"
                                        style={{ backgroundColor: urgencyColor(order.createdAt) }}
                                    />
                                    <span className="text-[10px] font-medium tabular-nums text-neutral-700">
                                        {orderLabel(order.orderNumber)}
                                    </span>
                                </div>

                                {/* Cart photos */}
                                <div className="flex gap-[3px] flex-1 justify-center">
                                    {order.cartPhotos.length === 0
                                        ? <div className="w-[18px] h-[26px] rounded-[3px] bg-neutral-300" />
                                        : order.cartPhotos.slice(0, 4).map((url, i) => (
                                            <div
                                                key={i}
                                                className="relative flex-shrink-0 rounded-[3px] overflow-hidden bg-neutral-200"
                                                style={{ width: 18, height: 26 }}
                                            >
                                                <Image
                                                    src={url}
                                                    alt=""
                                                    fill
                                                    className="object-cover"
                                                    sizes="18px"
                                                />
                                            </div>
                                        ))
                                    }
                                </div>

                                {/* Item count */}
                                <span className="text-[9px] font-semibold tracking-wide text-neutral-500 w-[46px] text-right flex-shrink-0">
                                    {order.itemCount} ITEM{order.itemCount !== 1 ? 'S' : ''}
                                </span>
                            </button>
                        )
                    })}
                </div>

                {/* Counter + controls */}
                <div className="px-7 pb-5">
                    <div className="flex justify-end mb-3">
                        <span className="text-[10px] text-neutral-500 tabular-nums">
                            {selected.size} / {orders.length} selected
                        </span>
                    </div>
                    <div className="flex flex-col gap-[6px]">
                        <button
                            onClick={() => setSelected(new Set())}
                            disabled={noneSelected}
                            className="text-left text-[9px] font-semibold tracking-[0.12em] disabled:text-neutral-300 text-neutral-600 transition-colors w-fit"
                        >
                            UNSELECT ALL
                        </button>
                        <button
                            onClick={() => setSelected(new Set(orders.map(o => o.id)))}
                            disabled={allSelected}
                            className="text-left text-[9px] font-semibold tracking-[0.12em] disabled:text-neutral-300 text-neutral-600 transition-colors w-fit"
                        >
                            SELECT ALL
                        </button>
                    </div>
                </div>

                {/* Begin */}
                <button
                    onClick={() => !noneSelected && setShowModeModal(true)}
                    disabled={noneSelected}
                    className="w-full text-center text-[26px] font-semibold tracking-tight pb-10 pt-4 transition-colors"
                    style={{ color: noneSelected ? '#c8c8c8' : '#1a1a1a' }}
                >
                    Begin
                </button>
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
        </div>
    )
}
