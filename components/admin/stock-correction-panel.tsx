'use client'

import { useEffect, useState } from 'react'
import type { ProductSize } from '@prisma/client'
import { commitInventoryChanges } from '@/app/admin/products/actions'
import { InventoryConfirmModal } from '@/components/admin/inventory-confirm-modal'

export type StockUiMode = 'view' | 'correcting' | 'adding'

/**
 * Per-size Stock / Available / Committed rows plus the "Make Correction" /
 * "Add Stock" action bar (Figma 1928:3242 default state / 1935:248 isCorrecting
 * state). Stock becomes an editable, pulsing field while correcting or adding;
 * Enter or the submit button opens the shared confirm modal, and confirming
 * runs commitInventoryChanges so every change lands in the inventory log.
 *
 * Shared between the product detail page and the products-new mobile stock
 * list's single-item view — both should behave identically.
 */
export function StockCorrectionPanel({
    productId,
    productName,
    sizes,
    onSizesChange,
    onModeChange,
}: {
    productId: string
    productName: string
    sizes: ProductSize[]
    onSizesChange: (sizes: ProductSize[]) => void
    /** Notified whenever view/correcting/adding changes — lets a parent gate
     *  its own "tap background to close" behavior while a correction is live. */
    onModeChange?: (mode: StockUiMode) => void
}) {
    const [stockMode, setStockModeState] = useState<StockUiMode>('view')
    const [stockEdits, setStockEdits] = useState<Record<string, string>>({})
    const [confirmingStock, setConfirmingStock] = useState(false)
    const [savingStock, setSavingStock] = useState(false)

    function setStockMode(mode: StockUiMode) {
        setStockModeState(mode)
        onModeChange?.(mode)
    }

    // Reset to a clean view whenever the target product changes underneath us.
    useEffect(() => {
        setStockEdits({})
        setStockMode('view')
        setConfirmingStock(false)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [productId])

    const stockChanges = sizes
        .map((sz) => {
            const raw = stockEdits[sz.id]
            if (raw === undefined || raw.trim() === '') return null
            const n = parseInt(raw, 10)
            if (!Number.isFinite(n)) return null
            const before = sz.total
            const after = Math.max(0, stockMode === 'adding' ? before + n : n)
            const delta = after - before
            if (delta === 0) return null
            return { sizeId: sz.id, sizeLabel: sz.size, before, after, delta }
        })
        .filter((c): c is { sizeId: string; sizeLabel: string; before: number; after: number; delta: number } => c !== null)

    function startCorrecting() {
        setStockEdits(Object.fromEntries(sizes.map((s) => [s.id, String(s.total)])))
        setStockMode('correcting')
    }

    function startAdding() {
        setStockEdits({})
        setStockMode('adding')
    }

    function discardStockEdit() {
        setStockEdits({})
        setStockMode('view')
        setConfirmingStock(false)
    }

    function submitStockEdit() {
        if (stockChanges.length === 0) {
            discardStockEdit()
            return
        }
        setConfirmingStock(true)
    }

    async function confirmStockChanges() {
        setSavingStock(true)
        try {
            await commitInventoryChanges(
                productId,
                stockChanges.map((c) => ({ sizeId: c.sizeId, delta: c.delta })),
            )
            onSizesChange(
                sizes.map((s) => {
                    const change = stockChanges.find((c) => c.sizeId === s.id)
                    if (!change) return s
                    const available = Math.max(0, change.after - s.committed)
                    return { ...s, total: change.after, available }
                }),
            )
            discardStockEdit()
        } finally {
            setSavingStock(false)
        }
    }

    return (
        <>
            {sizes.length === 0 ? (
                <p className="text-[12px] opacity-40 pt-8">No sizes yet</p>
            ) : (
                <div className="flex flex-col gap-8">
                    {sizes.map((sz) => {
                        const editing = stockMode !== 'view'
                        return (
                            <div key={sz.id} className="flex items-start justify-between gap-3">
                                <span className="font-alte text-[12px] font-bold leading-[1.6] whitespace-nowrap">
                                    {sz.size}
                                </span>
                                <div className="w-[60%] font-inter text-[12px] leading-[1.6]">
                                    <div
                                        className={`flex justify-between px-1 bg-[#f0f0f0] ${
                                            editing ? 'animate-pulse' : ''
                                        }`}
                                    >
                                        <span className="font-bold">Stock</span>
                                        {editing ? (
                                            <input
                                                value={stockEdits[sz.id] ?? ''}
                                                onChange={(e) =>
                                                    setStockEdits((prev) => ({ ...prev, [sz.id]: e.target.value }))
                                                }
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault()
                                                        submitStockEdit()
                                                    }
                                                }}
                                                inputMode="numeric"
                                                placeholder={stockMode === 'adding' ? '+0' : String(sz.total)}
                                                aria-label={`${stockMode === 'adding' ? 'Add to' : 'Correct'} ${sz.size} stock`}
                                                className="w-12 bg-transparent text-right font-bold outline-none"
                                            />
                                        ) : (
                                            <span className="font-bold">{sz.total}</span>
                                        )}
                                    </div>
                                    <div className="flex justify-between px-1">
                                        <span className="font-normal">Available</span>
                                        <span className="font-normal">{sz.available}</span>
                                    </div>
                                    <div className="flex justify-between px-1">
                                        <span className="font-extralight italic">Committed</span>
                                        <span className="font-extralight italic">{sz.committed}</span>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Dead zone around the action bar — stops propagation over a wider
                band than the buttons themselves so a near-miss tap next to
                "Make Correction" / "Add Stock" can't fall through to a parent's
                "tap the white area to close" handler. */}
            <div
                className="fixed bottom-0 inset-x-0 h-16 z-20"
                onClick={(e) => e.stopPropagation()}
            />

            {/* Make Correction / Add Stock (Figma 1928:3242 default state,
                1935:248 isCorrecting state). */}
            <div
                className="fixed bottom-4 inset-x-4 z-30 flex items-center justify-between text-[12px]"
                onClick={(e) => e.stopPropagation()}
            >
                {stockMode === 'view' ? (
                    <button type="button" onClick={startCorrecting} className="hover:opacity-60">
                        Make Correction
                    </button>
                ) : (
                    <button type="button" onClick={discardStockEdit} className="hover:opacity-60">
                        Cancel
                    </button>
                )}
                {stockMode === 'view' ? (
                    <button
                        type="button"
                        onClick={startAdding}
                        className="font-alte font-bold bg-[#f0f0f0] px-3 py-1 hover:opacity-70"
                    >
                        Add Stock
                    </button>
                ) : (
                    <button
                        type="button"
                        onClick={submitStockEdit}
                        className="font-alte font-bold bg-[#f0f0f0] px-3 py-1 hover:opacity-70"
                    >
                        {stockMode === 'correcting' ? 'Submit Correction' : 'Submit'}
                    </button>
                )}
            </div>

            {confirmingStock && (
                <InventoryConfirmModal
                    productName={productName}
                    changes={stockChanges}
                    saving={savingStock}
                    onConfirm={confirmStockChanges}
                    onCancel={() => setConfirmingStock(false)}
                    onDiscard={discardStockEdit}
                />
            )}
        </>
    )
}
