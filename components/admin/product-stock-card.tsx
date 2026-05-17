'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { STOCK_COLORS, STOCK_THRESHOLDS } from '@/lib/constants'
import { updateSizeStock } from '@/app/admin/products/actions'
import type { Product, ProductSize } from '@prisma/client'

type ProductWithSizes = Product & {
    sizes: ProductSize[]
}

type ImageEntry = {
    url: string
    isCartPrimary?: boolean
    isMobilePrimary?: boolean
    isDesktopPrimary?: boolean
}

type StockStatus = 'IN_STOCK' | 'LOW_STOCK' | 'NO_STOCK' | 'UNPUBLISHED'

function getStockStatus(sizes: ProductSize[], published: boolean): StockStatus {
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

const SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', 'XXL']

export function ProductStockCard({ product }: { product: ProductWithSizes }) {
    const [localSizes, setLocalSizes] = useState(product.sizes)
    const [savingId, setSavingId] = useState<string | null>(null)

    const totalAvailable = localSizes.reduce((sum, s) => sum + s.available, 0)
    const totalCommitted = localSizes.reduce((sum, s) => sum + s.committed, 0)
    const totalStock = totalAvailable + totalCommitted
    const status = getStockStatus(localSizes, product.published)
    const dot = STATUS_DOT[status]
    const isUnpublished = status === 'UNPUBLISHED'

    const sortedSizes = [...localSizes].sort(
        (a, b) => SIZE_ORDER.indexOf(a.size) - SIZE_ORDER.indexOf(b.size),
    )

    const raw = product.images as unknown
    const imgs = (Array.isArray(raw) ? raw : []) as ImageEntry[]
    const cartImg =
        imgs.find((i) => i?.isCartPrimary)?.url ??
        imgs.find((i) => i?.isMobilePrimary)?.url ??
        imgs[0]?.url ??
        null

    async function handleDelta(sizeId: string, delta: number) {
        setLocalSizes((prev) =>
            prev.map((s) =>
                s.id === sizeId
                    ? {
                          ...s,
                          available: Math.max(0, s.available + delta),
                          total: Math.max(0, s.available + delta) + s.committed,
                      }
                    : s,
            ),
        )
        setSavingId(sizeId)
        await updateSizeStock(sizeId, delta)
        setSavingId(null)
    }

    return (
        <div className="bg-white px-4 py-3 flex flex-col gap-[10px]">
            {/* ── Top row: thumb + name/status + meta ── */}
            <Link
                href={`/admin/products/${product.id}/edit`}
                className="flex items-center gap-3 group"
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

            {/* ── Size strip with inline +/− ── */}
            <div className="flex bg-[#fafafa]">
                {sortedSizes.map((size) => (
                    <div
                        key={size.id}
                        className="flex flex-col items-center flex-1 py-[6px]"
                    >
                        <span className="font-reformat text-[8px] tracking-[0.1em] font-bold uppercase leading-none mb-[5px] text-neutral-500">
                            {size.size}
                        </span>
                        <div
                            className={`flex items-center gap-[2px] transition-opacity ${
                                savingId === size.id ? 'opacity-40' : ''
                            }`}
                        >
                            <button
                                onClick={() => handleDelta(size.id, -1)}
                                disabled={size.available === 0 || savingId !== null}
                                className="text-neutral-400 hover:text-black disabled:opacity-20 px-[3px] text-[13px] leading-none"
                                aria-label={`Decrease ${size.size}`}
                            >
                                −
                            </button>
                            <span className="w-4 text-center font-alte text-[13px] leading-none tabular-nums">
                                {size.available}
                            </span>
                            <button
                                onClick={() => handleDelta(size.id, 1)}
                                disabled={savingId !== null}
                                className="text-neutral-400 hover:text-black disabled:opacity-20 px-[3px] text-[13px] leading-none"
                                aria-label={`Increase ${size.size}`}
                            >
                                +
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
