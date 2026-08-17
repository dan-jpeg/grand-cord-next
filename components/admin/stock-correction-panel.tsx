'use client'

import { useEffect, useState } from 'react'
import type { ProductSize } from '@prisma/client'
import { commitInventoryChanges } from '@/app/admin/products/actions'
import { InventoryConfirmModal } from '@/components/admin/inventory-confirm-modal'

export type StockUiMode = 'view' | 'correcting' | 'adding' | 'addingSize'

/** A size being drafted in "Add Size" mode — no row exists server-side yet. */
type DraftSize = { key: string; label: string; stock: string }

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
    const [draftSizes, setDraftSizes] = useState<DraftSize[]>([])
    // Sizes marked for removal in the current correction, by size id.
    const [pendingRemovals, setPendingRemovals] = useState<string[]>([])
    const [confirmingStock, setConfirmingStock] = useState(false)
    const [savingStock, setSavingStock] = useState(false)

    function setStockMode(mode: StockUiMode) {
        setStockModeState(mode)
        onModeChange?.(mode)
    }

    // Reset to a clean view whenever the target product changes underneath us.
    useEffect(() => {
        setStockEdits({})
        setDraftSizes([])
        setPendingRemovals([])
        setStockMode('view')
        setConfirmingStock(false)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [productId])

    // A size can only be removed once it's empty — no stock on the shelf and
    // nothing reserved against open orders. commitInventoryChanges re-checks
    // this server-side, so this is the affordance, not the guarantee.
    const canRemove = (sz: ProductSize) => sz.available <= 0 && sz.committed <= 0

    const stockChanges = sizes
        .filter((sz) => !pendingRemovals.includes(sz.id))
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

    // New sizes drafted in "Add Size" mode. Blank labels are ignored; a label
    // that collides with an existing size (or another draft) is flagged and
    // blocks submit — the DB has a unique [productId, size] and would throw.
    const takenLabels = new Set(sizes.map((s) => s.size.trim().toLowerCase()))
    const draftAdditions = draftSizes
        .map((d) => ({ ...d, label: d.label.trim() }))
        .filter((d) => d.label !== '')
    const duplicateKeys = new Set(
        draftAdditions
            .filter((d, i) => {
                const key = d.label.toLowerCase()
                return takenLabels.has(key) || draftAdditions.findIndex((o) => o.label.toLowerCase() === key) !== i
            })
            .map((d) => d.key),
    )
    const sizeChanges = draftAdditions.map((d) => {
        const stock = Math.max(0, parseInt(d.stock, 10) || 0)
        return {
            sizeId: d.key,
            sizeLabel: d.label,
            before: 0,
            after: stock,
            delta: stock,
            kind: 'add' as const,
        }
    })

    const removalChanges = sizes
        .filter((sz) => pendingRemovals.includes(sz.id))
        .map((sz) => ({
            sizeId: sz.id,
            sizeLabel: sz.size,
            before: sz.available,
            after: 0,
            delta: -sz.available,
            kind: 'remove' as const,
        }))

    function toggleRemoval(sizeId: string) {
        setPendingRemovals((prev) =>
            prev.includes(sizeId) ? prev.filter((id) => id !== sizeId) : [...prev, sizeId],
        )
    }

    function startCorrecting() {
        setStockEdits(Object.fromEntries(sizes.map((s) => [s.id, String(s.total)])))
        setStockMode('correcting')
    }

    function startAdding() {
        setStockEdits({})
        setStockMode('adding')
    }

    function addDraftSize() {
        setDraftSizes((prev) => [
            ...prev,
            { key: `draft-${Date.now().toString(36)}-${prev.length}`, label: '', stock: '' },
        ])
        setStockMode('addingSize')
    }

    function updateDraftSize(key: string, patch: Partial<DraftSize>) {
        setDraftSizes((prev) => prev.map((d) => (d.key === key ? { ...d, ...patch } : d)))
    }

    function discardStockEdit() {
        setStockEdits({})
        setDraftSizes([])
        setPendingRemovals([])
        setStockMode('view')
        setConfirmingStock(false)
    }

    function submitStockEdit() {
        if (stockMode === 'addingSize') {
            if (sizeChanges.length === 0 || duplicateKeys.size > 0) {
                if (sizeChanges.length === 0) discardStockEdit()
                return
            }
            setConfirmingStock(true)
            return
        }
        if (stockChanges.length === 0 && removalChanges.length === 0) {
            discardStockEdit()
            return
        }
        setConfirmingStock(true)
    }

    async function confirmStockChanges() {
        setSavingStock(true)
        try {
            const result = await commitInventoryChanges(
                productId,
                stockChanges.map((c) => ({ sizeId: c.sizeId, delta: c.delta })),
                sizeChanges.map((c) => ({ size: c.sizeLabel, available: c.after })),
                removalChanges.map((c) => c.sizeId),
            )
            const updated = sizes
                .filter((s) => !pendingRemovals.includes(s.id))
                .map((s) => {
                    const change = stockChanges.find((c) => c.sizeId === s.id)
                    if (!change) return s
                    const available = Math.max(0, change.after - s.committed)
                    return { ...s, total: change.after, available }
                })
            // Newly created sizes come back from the server with real ids, so
            // the list stays usable (correctable) without a refetch.
            const created: ProductSize[] = result.createdSizes.map((s) => ({
                id: s.id,
                productId,
                size: s.size,
                available: s.available,
                committed: 0,
                total: s.available,
                createdAt: new Date(),
                updatedAt: new Date(),
            }))
            onSizesChange([...updated, ...created])
            discardStockEdit()
        } finally {
            setSavingStock(false)
        }
    }

    return (
        <>
            {sizes.length === 0 && draftSizes.length === 0 ? (
                <p className="text-[12px] opacity-40 pt-8">No sizes yet</p>
            ) : (
                <div className="flex flex-col gap-8">
                    {sizes.map((sz) => {
                        // Existing rows only become editable for stock edits —
                        // "Add Size" leaves them alone.
                        const editing = stockMode === 'correcting' || stockMode === 'adding'
                        const removing = pendingRemovals.includes(sz.id)
                        return (
                            <div
                                key={sz.id}
                                className={`flex items-start justify-between gap-3 ${
                                    removing ? 'opacity-40' : ''
                                }`}
                            >
                                <span className="font-alte text-[12px] font-bold leading-[1.6] whitespace-nowrap flex flex-col items-start">
                                    <span className={removing ? 'line-through' : ''}>{sz.size}</span>
                                    {/* Removal is offered during a correction and
                                        only once the size is empty — the server
                                        rejects removing a size that still holds
                                        stock or has units reserved. */}
                                    {stockMode === 'correcting' && canRemove(sz) && (
                                        <button
                                            type="button"
                                            onClick={() => toggleRemoval(sz.id)}
                                            className={`font-inter text-[10px] font-normal leading-[1.6] underline underline-offset-[3px] hover:opacity-70 ${
                                                removing ? '' : 'text-[#DB0B00]'
                                            }`}
                                        >
                                            {removing ? 'Undo' : 'Remove'}
                                        </button>
                                    )}
                                </span>
                                <div className="w-[60%] font-inter text-[12px] leading-[1.6]">
                                    <div
                                        className={`flex justify-between px-1 bg-[#f0f0f0] ${
                                            editing && !removing ? 'animate-pulse' : ''
                                        }`}
                                    >
                                        <span className="font-bold">Stock</span>
                                        {editing && !removing ? (
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

                    {/* Draft rows for "Add Size" — same shape as a real size
                        row, with the label and opening stock both editable.
                        Available/Committed are fixed until it exists. */}
                    {draftSizes.map((d) => {
                        const duplicate = duplicateKeys.has(d.key)
                        return (
                            <div key={d.key} className="flex items-start justify-between gap-3">
                                <input
                                    value={d.label}
                                    onChange={(e) => updateDraftSize(d.key, { label: e.target.value })}
                                    placeholder="Size"
                                    aria-label="New size name"
                                    autoCapitalize="characters"
                                    autoCorrect="off"
                                    spellCheck={false}
                                    className={`w-[30%] bg-transparent font-alte text-[12px] font-bold leading-[1.6] outline-none placeholder:opacity-30 ${
                                        duplicate ? 'text-[#DB0B00]' : ''
                                    }`}
                                />
                                <div className="w-[60%] font-inter text-[12px] leading-[1.6]">
                                    <div className="flex justify-between px-1 bg-[#f0f0f0] animate-pulse">
                                        <span className="font-bold">Stock</span>
                                        <input
                                            value={d.stock}
                                            onChange={(e) => updateDraftSize(d.key, { stock: e.target.value })}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault()
                                                    submitStockEdit()
                                                }
                                            }}
                                            inputMode="numeric"
                                            placeholder="0"
                                            aria-label={`Opening stock for ${d.label || 'new size'}`}
                                            className="w-12 bg-transparent text-right font-bold outline-none"
                                        />
                                    </div>
                                    <div className="flex justify-between px-1">
                                        <span className="font-normal">Available</span>
                                        <span className="font-normal">
                                            {Math.max(0, parseInt(d.stock, 10) || 0)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between px-1">
                                        <span className="font-extralight italic">Committed</span>
                                        <span className="font-extralight italic">0</span>
                                    </div>
                                    {duplicate && (
                                        <p className="px-1 text-[10px] text-[#DB0B00]">
                                            That size already exists
                                        </p>
                                    )}
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
                <div className="flex items-center gap-4">
                    {/* Add Size sits to the left of Add Stock, plain (no chip
                        background) so the grey stays on the primary action.
                        In Add Size mode it appends another draft row. */}
                    {(stockMode === 'view' || stockMode === 'addingSize') && (
                        <button
                            type="button"
                            onClick={addDraftSize}
                            className="font-alte font-bold px-1 py-1 hover:opacity-60"
                        >
                            Add Size
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
                            disabled={stockMode === 'addingSize' && duplicateKeys.size > 0}
                            className="font-alte font-bold bg-[#f0f0f0] px-3 py-1 hover:opacity-70 disabled:opacity-40"
                        >
                            {stockMode === 'correcting' ? 'Submit Correction' : 'Submit'}
                        </button>
                    )}
                </div>
            </div>

            {confirmingStock && (
                <InventoryConfirmModal
                    productName={productName}
                    changes={
                        stockMode === 'addingSize' ? sizeChanges : [...stockChanges, ...removalChanges]
                    }
                    saving={savingStock}
                    onConfirm={confirmStockChanges}
                    onCancel={() => setConfirmingStock(false)}
                    onDiscard={discardStockEdit}
                />
            )}
        </>
    )
}
