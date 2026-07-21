'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { STOCK_COLORS, STOCK_THRESHOLDS } from '@/lib/constants'
import { commitInventoryChanges } from '@/app/admin/products/actions'
import { InventoryConfirmModal, LockIcon } from './inventory-confirm-modal'
import type { Product, ProductSize } from '@prisma/client'

type ProductWithSizes = Product & {
    sizes: ProductSize[]
}

type ImageEntry = {
    url: string
    isCartPrimary?: boolean
    isMobilePrimary?: boolean
    isDesktopPrimary?: boolean
    isInventoryPrimary?: boolean
}

type StockStatus = 'IN_STOCK' | 'LOW_STOCK' | 'NO_STOCK' | 'UNPUBLISHED'

function getStockStatus(sizes: { available: number }[], published: boolean): StockStatus {
    const totalAvailable = sizes.reduce((sum, s) => sum + s.available, 0)
    if (!published) return 'UNPUBLISHED'
    if (totalAvailable === 0) return 'NO_STOCK'
    if (totalAvailable <= STOCK_THRESHOLDS.LOW_STOCK) return 'LOW_STOCK'
    return 'IN_STOCK'
}

const STATUS_DOT: Record<StockStatus, string> = {
    IN_STOCK: STOCK_COLORS.IN_STOCK,
    LOW_STOCK: STOCK_COLORS.LOW_STOCK,
    NO_STOCK: STOCK_COLORS.NO_STOCK,
    UNPUBLISHED: '#ffffff',
}

const SIZE_ORDER = ['1', '2', '3', '4', '5', 'o/s']

export function ProductStockCard({ product }: { product: ProductWithSizes }) {
    const [baseSizes, setBaseSizes] = useState(product.sizes)
    const [pending, setPending] = useState<Record<string, number>>({})
    const [unlocked, setUnlocked] = useState(false)
    const [confirming, setConfirming] = useState(false)
    const [saving, setSaving] = useState(false)

    const displaySizes = baseSizes.map((s) => ({
        ...s,
        available: Math.max(0, s.available + (pending[s.id] ?? 0)),
    }))

    const totalAvailable = displaySizes.reduce((sum, s) => sum + s.available, 0)
    const totalCommitted = displaySizes.reduce((sum, s) => sum + s.committed, 0)
    const totalStock = totalAvailable + totalCommitted
    const status = getStockStatus(displaySizes, product.published)
    const dot = STATUS_DOT[status]
    const isUnpublished = status === 'UNPUBLISHED'

    const sortedSizes = [...displaySizes].sort(
        (a, b) => SIZE_ORDER.indexOf(a.size) - SIZE_ORDER.indexOf(b.size),
    )

    const raw = product.images as unknown
    const imgs = (Array.isArray(raw) ? raw : []) as ImageEntry[]
    const cartImg =
        imgs.find((i) => i?.isInventoryPrimary)?.url ??
        imgs.find((i) => i?.isCartPrimary)?.url ??
        imgs.find((i) => i?.isMobilePrimary)?.url ??
        imgs[0]?.url ??
        null

    const effectiveChanges = baseSizes
        .map((s) => {
            const delta = pending[s.id] ?? 0
            const before = s.available
            const after = Math.max(0, before + delta)
            return { size: s, before, after, delta: after - before }
        })
        .filter((c) => c.delta !== 0)

    const hasChanges = effectiveChanges.length > 0

    function bump(sizeId: string, dir: 1 | -1) {
        setPending((prev) => {
            const base = baseSizes.find((s) => s.id === sizeId)
            if (!base) return prev
            const current = prev[sizeId] ?? 0
            const nextDelta = current + dir
            const projected = base.available + nextDelta
            if (projected < 0) return prev
            return { ...prev, [sizeId]: nextDelta }
        })
    }

    function handleLockClick() {
        if (!unlocked) {
            setUnlocked(true)
            return
        }
        if (!hasChanges) {
            setUnlocked(false)
            return
        }
        setConfirming(true)
    }

    async function handleConfirm() {
        setSaving(true)
        try {
            const changes = effectiveChanges.map((c) => ({
                sizeId: c.size.id,
                delta: c.delta,
            }))
            await commitInventoryChanges(product.id, changes)
            setBaseSizes((prev) =>
                prev.map((s) => {
                    const change = effectiveChanges.find((c) => c.size.id === s.id)
                    if (!change) return s
                    return {
                        ...s,
                        available: change.after,
                        total: change.after + s.committed,
                    }
                }),
            )
            setPending({})
            setUnlocked(false)
            setConfirming(false)
        } finally {
            setSaving(false)
        }
    }

    function handleDiscard() {
        setPending({})
        setUnlocked(false)
        setConfirming(false)
    }

    return (
        <div className="bg-white px-4 py-3 flex flex-col gap-[10px]">
            {/* ── Top row: thumb + name/status + meta + lock ── */}
            <div className="flex items-center gap-3">
                <Link
                    href={`/admin/products/${product.id}/edit`}
                    className="flex items-center gap-3 group flex-1 min-w-0"
                >
                    <div
                        className="relative flex-shrink-0 bg-[#fafafa]"
                        style={{ width: 32, height: 40 }}
                    >
                        {cartImg ? (
                            <Image
                                src={cartImg}
                                alt=""
                                fill
                                className="object-contain"
                                sizes="32px"
                            />
                        ) : (
                            <div className="w-full h-full" />
                        )}
                    </div>

                    <div className="flex-1 min-w-0 flex flex-col gap-[3px]">
                        <div className="flex items-center gap-[6px] min-w-0">
                            <span
                                className="rounded-full flex-shrink-0"
                                style={{
                                    display: 'inline-block',
                                    width: 8,
                                    height: 8,
                                    backgroundColor: dot,
                                    border: isUnpublished ? '1px solid #1a1a1a' : 'none',
                                }}
                            />
                            <span className="font-alte text-[14px] leading-none truncate group-hover:underline">
                                {product.name}
                            </span>
                        </div>
                        <span className="font-reformat text-[9px] tracking-[0.1em] uppercase text-neutral-500 leading-none">
                            Stock {totalStock} · {totalAvailable} avail · {totalCommitted} committed
                        </span>
                    </div>
                </Link>
                <button
                    type="button"
                    onClick={handleLockClick}
                    className="flex-shrink-0 p-[6px] text-neutral-400 hover:text-black"
                    aria-label={unlocked ? 'Lock inventory controls' : 'Unlock inventory controls'}
                    aria-pressed={unlocked}
                >
                    <LockIcon unlocked={unlocked} />
                </button>
            </div>

            {/* ── Size strip with inline +/− ── */}
            <div className="flex bg-[#fafafa]">
                {sortedSizes.map((size) => {
                    const delta = pending[size.id] ?? 0
                    return (
                        <div
                            key={size.id}
                            className="flex flex-col items-center flex-1 py-[6px]"
                        >
                            <span className="font-reformat text-[8px] tracking-[0.1em] font-bold uppercase leading-none mb-[5px] text-neutral-500">
                                {size.size}
                            </span>
                            <div className="flex items-center gap-[2px]">
                                {unlocked && (
                                    <button
                                        onClick={() => bump(size.id, -1)}
                                        disabled={size.available === 0}
                                        className="text-neutral-400 hover:text-black disabled:opacity-20 px-[3px] text-[13px] leading-none"
                                        aria-label={`Decrease ${size.size}`}
                                    >
                                        −
                                    </button>
                                )}
                                <span
                                    className={`w-4 text-center font-alte text-[13px] leading-none tabular-nums ${
                                        delta !== 0 ? 'text-black font-bold' : ''
                                    }`}
                                >
                                    {size.available}
                                </span>
                                {unlocked && (
                                    <button
                                        onClick={() => bump(size.id, 1)}
                                        className="text-neutral-400 hover:text-black px-[3px] text-[13px] leading-none"
                                        aria-label={`Increase ${size.size}`}
                                    >
                                        +
                                    </button>
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>

            {confirming && (
                <InventoryConfirmModal
                    productName={product.name}
                    changes={effectiveChanges.map((c) => ({
                        sizeId: c.size.id,
                        sizeLabel: c.size.size,
                        before: c.before,
                        after: c.after,
                        delta: c.delta,
                    }))}
                    saving={saving}
                    onConfirm={handleConfirm}
                    onCancel={() => setConfirming(false)}
                    onDiscard={handleDiscard}
                />
            )}
        </div>
    )
}

