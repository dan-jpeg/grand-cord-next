'use client'

import { useState, useMemo, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { StockKey } from './stock-key'
import { ProductStockCard } from './product-stock-card'
import { STOCK_THRESHOLDS } from '@/lib/constants'
import type { Product, ProductSize } from '@prisma/client'
import { matchesProductSearch } from '@/lib/product-search'

type ProductWithSizes = Product & {
    sizes: ProductSize[]
}

type StockFilter = 'ALL' | 'IN_STOCK' | 'LOW_STOCK' | 'NO_STOCK' | 'UNPUBLISHED'
type ViewMode = 'stock' | 'photo' | 'color'

const ITEMS_PER_PAGE = 15

function getProductStockStatus(product: ProductWithSizes): StockFilter {
    const totalAvailable = product.sizes.reduce((sum, s) => sum + s.available, 0)

    if (!product.published) return 'UNPUBLISHED'
    if (totalAvailable === 0) return 'NO_STOCK'
    if (totalAvailable <= STOCK_THRESHOLDS.LOW_STOCK) return 'LOW_STOCK'
    return 'IN_STOCK'
}


export function ProductsTable({ products }: { products: ProductWithSizes[] }) {
    const [search, setSearch] = useState('')
    const [stockFilter, setStockFilter] = useState<StockFilter>('ALL')
    const [viewMode, setViewMode] = useState<ViewMode>('stock')
    const [currentPage, setCurrentPage] = useState(1)
    const [isMobile, setIsMobile] = useState(false)

    useEffect(() => {
        const checkMobile = () => {
            const mobile = window.innerWidth < 768
            setIsMobile(mobile)
            if (mobile) setViewMode((prev) => prev === 'stock' ? 'photo' : prev)
        }
        checkMobile()
        window.addEventListener('resize', checkMobile)
        return () => window.removeEventListener('resize', checkMobile)
    }, [])

    const alertCounts = useMemo(() => {
        const noStock = products.filter((p) => p.published && p.sizes.reduce((s, sz) => s + sz.available, 0) === 0).length
        const lowStock = products.filter((p) => {
            const avail = p.sizes.reduce((s, sz) => s + sz.available, 0)
            return p.published && avail > 0 && avail <= STOCK_THRESHOLDS.LOW_STOCK
        }).length
        return { noStock, lowStock }
    }, [products])

    // ... rest of logic ...

    const filteredProducts = useMemo(() => {
        let filtered = products

        if (search.trim()) {
            filtered = filtered.filter((product) => matchesProductSearch(product, search))
        }

        if (stockFilter !== 'ALL') {
            filtered = filtered.filter((product) => getProductStockStatus(product) === stockFilter)
        }

        return filtered
    }, [products, search, stockFilter])

    const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE)
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
    const paginatedProducts = filteredProducts.slice(startIndex, startIndex + ITEMS_PER_PAGE)

    return (
        <div className="w-full flex justify-center pt-42 pb-8">

            {/* Alert Bar */}
            {(alertCounts.noStock > 0 || alertCounts.lowStock > 0) && (
                <div className="fixed top-8 md:top-8 left-0 right-0 flex justify-center z-40 pointer-events-none">
                    <div className="flex gap-3 pointer-events-auto">
                        {alertCounts.noStock > 0 && (
                            <button
                                onClick={() => { setStockFilter('NO_STOCK'); setCurrentPage(1) }}
                                className="text-[7pt] font-bold uppercase px-2 py-0.5 bg-white border border-black hover:bg-black hover:text-white transition-colors"
                            >
                                {alertCounts.noStock} OUT OF STOCK
                            </button>
                        )}
                        {alertCounts.lowStock > 0 && (
                            <button
                                onClick={() => { setStockFilter('LOW_STOCK'); setCurrentPage(1) }}
                                className="text-[7pt] font-bold uppercase px-2 py-0.5 bg-white border border-black hover:bg-black hover:text-white transition-colors"
                            >
                                {alertCounts.lowStock} LOW STOCK
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Fixed Top Bar - View Mode Toggle */}
            <div className="fixed top-32 md:top-3 left-0 right-0 flex justify-center z-50">
                <div className="flex gap-4 text-[8pt]">
                    <button
                        onClick={() => setViewMode('photo')}
                        className={viewMode === 'photo' ? 'underline font-bold' : 'font-bold opacity-30 hover:underline'}
                    >
                        Show Images
                    </button>
                    <button
                        onClick={() => setViewMode('stock')}
                        className={viewMode === 'stock' ? 'underline font-bold' : 'hover:underline'}
                    >
                        Show Stock
                    </button>
                </div>
            </div>

            {/* Stock Key with Filtering */}
            <div className={isMobile ? 'fixed top-12 left-4 z-50' : ''}>
                <StockKey
                    variant={isMobile ? 'grid' : 'row'}
                    selectedFilter={stockFilter}
                    onFilterChange={(filter) => {
                        setStockFilter(filter)
                        setCurrentPage(1)
                    }}
                />
            </div>

            {/* Fixed Add Product Button */}
            <Link
                href="/admin/products/new"
                className="bg-black fixed bottom-4 right-4 text-white px-3 py-1 text-[9pt] font-bold uppercase hover:bg-neutral-800 z-50"
            >
                + ADD PRODUCT
            </Link>

            {/* Main Content - Centered */}
            <div className="w-full max-w-[900px] space-y-4">
                <div className="flex items-center justify-between mb-4 text-[8pt]">
                    <div className="flex-1 relative">
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => {
                                setSearch(e.target.value)
                                setCurrentPage(1)
                            }}
                            className="absolute inset-0 opacity-0 cursor-default"
                            autoFocus
                        />

                        <div className="pointer-events-none">
                            {search ? (
                                <div className="font-bold">■ {search}</div>
                            ) : (
                                <div>■ Start Typing to Search By Keyword, Item Code, Color, Material, or Designer</div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Stock View - Tight Grid */}
                {viewMode === 'stock' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-0 ">
                        {paginatedProducts.map((product) => (
                            <ProductStockCard key={product.id} product={product}/>
                        ))}
                    </div>
                )}


                {/* Photo View */}
                {viewMode === 'photo' && (
                    <div className="grid grid-cols-4 md:grid-cols-8 gap-3">
                        {paginatedProducts.map((product) => {
                            const raw = product.images as unknown
                            const imgs = Array.isArray(raw) ? raw : []
                            const cartImg = imgs.find(
                                (img): img is { url: string } =>
                                    typeof img === 'object' && img !== null && 'isCartPrimary' in img && (img as { isCartPrimary: boolean }).isCartPrimary
                            ) ?? (imgs[0] as { url?: string } | undefined)
                            const src = typeof cartImg === 'object' && cartImg !== null ? (cartImg as { url?: string }).url : undefined

                            return (
                                <Link
                                    key={product.id}
                                    href={`/admin/products/${product.id}/edit`}
                                    className="group"
                                >
                                    {src ? (
                                        <Image
                                            src={src}
                                            alt={product.name}
                                            width={80}
                                            height={100}
                                            className="w-full h-auto"
                                        />
                                    ) : (
                                        <div className="w-full aspect-[4/5] bg-neutral-100 flex items-center justify-center text-neutral-300 text-[6pt]">
                                            —
                                        </div>
                                    )}
                                    <p className="mt-1 text-[6pt] font-bold uppercase leading-tight group-hover:underline">{product.name}</p>
                                </Link>
                            )
                        })}
                    </div>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-end gap-2 text-sm py-4">
                        <button
                            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="disabled:opacity-30"
                        >
                            &lt;
                        </button>
                        <span className="font-bold">
                            Page {currentPage}/{totalPages}
                        </span>
                        <button
                            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            className="disabled:opacity-30"
                        >
                            &gt;
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}
