'use client'

import { useState } from 'react'
import Link from 'next/link'
import { STOCK_COLORS, STOCK_THRESHOLDS } from '@/lib/constants'
import { updateSizeStock } from '@/app/admin/products/actions'
import type { Product, ProductSize } from '@prisma/client'

type ProductWithSizes = Product & {
    sizes: ProductSize[]
}

function getStockStatus(sizes: ProductSize[], published: boolean) {
    const totalAvailable = sizes.reduce((sum, s) => sum + s.available, 0)
    if (!published) return 'UNPUBLISHED'
    if (totalAvailable === 0) return 'NO_STOCK'
    if (totalAvailable <= STOCK_THRESHOLDS.LOW_STOCK) return 'LOW_STOCK'
    return 'IN_STOCK'
}

function getStockColor(status: string) {
    switch (status) {
        case 'IN_STOCK': return STOCK_COLORS.IN_STOCK
        case 'LOW_STOCK': return STOCK_COLORS.LOW_STOCK
        case 'NO_STOCK': return STOCK_COLORS.NO_STOCK
        case 'UNPUBLISHED': return STOCK_COLORS.UNPUBLISHED
        default: return STOCK_COLORS.UNPUBLISHED
    }
}

const SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', 'XXL']

export function ProductStockCard({ product }: { product: ProductWithSizes }) {
    const [localSizes, setLocalSizes] = useState(product.sizes)
    const [savingId, setSavingId] = useState<string | null>(null)

    const totalAvailable = localSizes.reduce((sum, s) => sum + s.available, 0)
    const totalCommitted = localSizes.reduce((sum, s) => sum + s.committed, 0)
    const totalStock = totalAvailable + totalCommitted
    const status = getStockStatus(localSizes, product.published)
    const color = getStockColor(status)

    const sortedSizes = [...localSizes].sort(
        (a, b) => SIZE_ORDER.indexOf(a.size) - SIZE_ORDER.indexOf(b.size)
    )

    async function handleDelta(sizeId: string, delta: number) {
        setLocalSizes((prev) =>
            prev.map((s) =>
                s.id === sizeId
                    ? { ...s, available: Math.max(0, s.available + delta), total: Math.max(0, s.available + delta) + s.committed }
                    : s
            )
        )
        setSavingId(sizeId)
        await updateSizeStock(sizeId, delta)
        setSavingId(null)
    }

    return (
        <div className="p-1 max-w-[450px] hover:bg-neutral-50 transition-colors">
            <div className="flex gap-1">
                {/* Left column: name + color dot — links to edit */}
                <Link
                    href={`/admin/products/${product.id}/edit`}
                    className="flex flex-col items-center w-[30px] shrink-0"
                >
                    <span className="text-[8pt] font-bold uppercase mb-1">
                        {product.name}
                    </span>
                    <div
                        className="w-[30px] h-[30px]"
                        style={{
                            backgroundColor: color,
                            border: status === 'UNPUBLISHED' ? '2px solid black' : 'none',
                        }}
                    />
                </Link>

                {/* Right column */}
                <div className="flex-1 min-w-0">
                    {/* Meta row */}
                    <div className="flex items-center text-[8pt] font-bold uppercase">
                        <span>STOCK: {totalStock}</span>
                        <span className="ml-auto italic font-normal">
                            ({totalAvailable} avail, {totalCommitted} committed)
                        </span>
                    </div>

                    {/* Sizes with inline +/− */}
                    <div className="mt-2 border-2 border-black">
                        <div className="flex justify-between text-[8pt] font-mono">
                            {sortedSizes.map((size) => (
                                <div key={size.id} className="flex flex-col items-center flex-1 py-1">
                                    <span className="font-bold leading-none">{size.size}</span>
                                    <div className={`flex items-center gap-0.5 mt-0.5 transition-opacity ${savingId === size.id ? 'opacity-40' : ''}`}>
                                        <button
                                            onClick={() => handleDelta(size.id, -1)}
                                            disabled={size.available === 0 || savingId !== null}
                                            className="text-neutral-400 hover:text-black disabled:opacity-20 px-0.5 leading-none"
                                        >
                                            −
                                        </button>
                                        <span className="w-4 text-center">{size.available}</span>
                                        <button
                                            onClick={() => handleDelta(size.id, 1)}
                                            disabled={savingId !== null}
                                            className="text-neutral-400 hover:text-black disabled:opacity-20 px-0.5 leading-none"
                                        >
                                            +
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
