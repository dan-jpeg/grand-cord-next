'use client'

import { useState, useMemo, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ProductStockCard } from './product-stock-card'
import { STOCK_THRESHOLDS, STOCK_COLORS } from '@/lib/constants'
import type { Product, ProductSize } from '@prisma/client'
import { matchesProductSearch } from '@/lib/product-search'

type ProductWithSizes = Product & {
    sizes: ProductSize[]
}

type StockFilter = 'ALL' | 'IN_STOCK' | 'LOW_STOCK' | 'NO_STOCK' | 'UNPUBLISHED'
type ViewMode = 'stock' | 'photo'

const ITEMS_PER_PAGE = 15

function statusOf(p: ProductWithSizes): Exclude<StockFilter, 'ALL'> {
    const avail = p.sizes.reduce((s, sz) => s + sz.available, 0)
    if (!p.published) return 'UNPUBLISHED'
    if (avail === 0) return 'NO_STOCK'
    if (avail <= STOCK_THRESHOLDS.LOW_STOCK) return 'LOW_STOCK'
    return 'IN_STOCK'
}

const DOT: Record<Exclude<StockFilter, 'ALL'>, string> = {
    IN_STOCK: STOCK_COLORS.IN_STOCK,
    LOW_STOCK: STOCK_COLORS.LOW_STOCK,
    NO_STOCK: STOCK_COLORS.NO_STOCK,
    UNPUBLISHED: '#a3a3a3',
}

function StockChip({
    label,
    dot,
    bordered,
    active,
    dimmed,
    onClick,
}: {
    label: string
    dot?: string
    bordered?: boolean
    active?: boolean
    dimmed?: boolean
    onClick?: () => void
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="flex items-center gap-[5px] bg-white px-[10px] py-[7px] flex-shrink-0 transition-opacity"
            style={{ opacity: dimmed ? 0.4 : 1 }}
        >
            {dot && (
                <span
                    className="rounded-full flex-shrink-0"
                    style={{
                        display: 'inline-block',
                        width: 8,
                        height: 8,
                        backgroundColor: dot,
                        border: bordered ? '1px solid #1a1a1a' : 'none',
                    }}
                />
            )}
            <span
                className={`text-[8px] font-bold tracking-[0.09em] uppercase ${
                    active ? 'underline underline-offset-2' : ''
                }`}
            >
                {label}
            </span>
        </button>
    )
}

export function ProductsTable({ products }: { products: ProductWithSizes[] }) {
    const [search, setSearch] = useState('')
    const [stockFilter, setStockFilter] = useState<StockFilter>('ALL')
    const [viewMode, setViewMode] = useState<ViewMode>('photo')
    const [currentPage, setCurrentPage] = useState(1)
    const [isMobile, setIsMobile] = useState(false)

    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 768)
        }
        checkMobile()
        window.addEventListener('resize', checkMobile)
        return () => window.removeEventListener('resize', checkMobile)
    }, [])

    const counts = useMemo(() => {
        let inStock = 0,
            lowStock = 0,
            noStock = 0,
            unpub = 0
        for (const p of products) {
            const s = statusOf(p)
            if (s === 'IN_STOCK') inStock++
            else if (s === 'LOW_STOCK') lowStock++
            else if (s === 'NO_STOCK') noStock++
            else unpub++
        }
        return { inStock, lowStock, noStock, unpub }
    }, [products])

    const filteredProducts = useMemo(() => {
        let f = products
        if (search.trim()) f = f.filter((p) => matchesProductSearch(p, search))
        if (stockFilter !== 'ALL') f = f.filter((p) => statusOf(p) === stockFilter)
        return f
    }, [products, search, stockFilter])

    const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE)
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
    const paginatedProducts = filteredProducts.slice(startIndex, startIndex + ITEMS_PER_PAGE)

    function toggleFilter(f: StockFilter) {
        setStockFilter((prev) => (prev === f ? 'ALL' : f))
        setCurrentPage(1)
    }

    const filterActive = stockFilter !== 'ALL'

    return (
        <div className="w-full max-w-screen-md mx-auto pt-3">
            {/* ── White slab header ── */}
            <div className="bg-white pt-8 pb-5 ">
                <div className="flex items-baseline gap-[14px] mb-4 flex-wrap">
                    <span className="font-alte text-[53px] leading-none tracking-[-0.03em] text-black">

                    </span>
                    {!isMobile && (
                        <>
                            <button
                                type="button"
                                onClick={() => setViewMode('stock')}
                                className="font-alte text-[36px] leading-none tracking-[-0.03em] text-black transition-opacity active:opacity-60"
                                style={{ opacity: viewMode === 'stock' ? 1 : 0.18 }}
                            >
                                Stock
                            </button>
                            <button
                                type="button"
                                onClick={() => setViewMode('photo')}
                                className="font-alte text-[36px] leading-none tracking-[-0.03em] text-black transition-opacity active:opacity-60"
                                style={{ opacity: viewMode === 'photo' ? 1 : 0.18 }}
                            >
                                Photos
                            </button>
                        </>
                    )}
                </div>

                {/* Filter chips — replaces StockKey + alert bar */}
                <div className="flex gap-[6px] overflow-x-auto [&::-webkit-scrollbar]:hidden">
                    <StockChip
                        label={`All · ${products.length}`}
                        active={!filterActive}
                        dimmed={filterActive}
                        onClick={() => {
                            setStockFilter('ALL')
                            setCurrentPage(1)
                        }}
                    />
                    <StockChip
                        label={`${counts.inStock} In Stock`}
                        dot={DOT.IN_STOCK}
                        active={stockFilter === 'IN_STOCK'}
                        dimmed={filterActive && stockFilter !== 'IN_STOCK'}
                        onClick={() => toggleFilter('IN_STOCK')}
                    />
                    <StockChip
                        label={`${counts.lowStock} Low`}
                        dot={DOT.LOW_STOCK}
                        active={stockFilter === 'LOW_STOCK'}
                        dimmed={filterActive && stockFilter !== 'LOW_STOCK'}
                        onClick={() => toggleFilter('LOW_STOCK')}
                    />
                    <StockChip
                        label={`${counts.noStock} Out`}
                        dot={DOT.NO_STOCK}
                        active={stockFilter === 'NO_STOCK'}
                        dimmed={filterActive && stockFilter !== 'NO_STOCK'}
                        onClick={() => toggleFilter('NO_STOCK')}
                    />
                    <StockChip
                        label={`${counts.unpub} Unpublished`}
                        dot="#ffffff"
                        bordered
                        active={stockFilter === 'UNPUBLISHED'}
                        dimmed={filterActive && stockFilter !== 'UNPUBLISHED'}
                        onClick={() => toggleFilter('UNPUBLISHED')}
                    />
                </div>
            </div>

            {/* ── Search slab ── */}
            <div className="mt-3 bg-white px-5   py-[14px] relative">
                <input
                    type="text"
                    value={search}
                    onChange={(e) => {
                        setSearch(e.target.value)
                        setCurrentPage(1)
                    }}
                    className="absolute inset-0 opacity-0     cursor-text"
                    autoFocus
                />
                <div className="pointer-events-none  font-reformat text-[10px] tracking-[0.12em] uppercase">
                    {search ? (
                        <span className="text-black">■ {search}</span>
                    ) : (
                        <span className="text-neutral-400 ">
                            ■ Search by keyword, item code, color, material, or designer
                        </span>
                    )}
                </div>
            </div>

            {/* ── Result count ── */}
            <div className="flex justify-end px-1  pt-3">
                <span className="font-reformat border-[black/40] border-[0.5px] border-dashed rounded-lg text-[10px] tracking-[0.12em] uppercase bg-white px-[10px] py-[5px]">
                    {filteredProducts.length} / {products.length} shown
                </span>
            </div>

            {/* ── Body ── */}
            <div className="mt-3">
                {viewMode === 'stock' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-[1px] bg-[#e8e8e8]">
                        {paginatedProducts.map((product) => (
                            <ProductStockCard key={product.id} product={product} />
                        ))}
                    </div>
                )}

                {viewMode === 'photo' && (
                    <div className="bg-white p-4  border-black/20 border-[0.5px]">
                        <div className="  border-black  grid grid-cols-4 md:grid-cols-8 gap-3">
                            {paginatedProducts.map((product) => {
                                const raw = product.images as unknown
                                const imgs = Array.isArray(raw) ? raw : []
                                const cartImg =
                                    imgs.find(
                                        (img): img is { url: string } =>
                                            typeof img === 'object' &&
                                            img !== null &&
                                            'isCartPrimary' in img &&
                                            (img as { isCartPrimary: boolean }).isCartPrimary,
                                    ) ?? (imgs[0] as { url?: string } | undefined)
                                const src =
                                    typeof cartImg === 'object' && cartImg !== null
                                        ? (cartImg as { url?: string }).url
                                        : undefined

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
                                        <p className="mt-1 font-alte text-[10px] leading-tight group-hover:underline truncate">
                                            {product.name}
                                        </p>
                                    </Link>
                                )
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* ── Pagination ── */}
            {totalPages > 1 && (
                <div className="flex items-center  justify-end gap-3 py-6 pr-2">
                    <button
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="text-[24px] leading-none font-bold text-black/30 disabled:opacity-0 active:text-black/60 transition-opacity"
                        aria-label="Previous page"
                    >
                        ‹
                    </button>
                    <span className="font-reformat text-[10px] tracking-[0.12em] uppercase bg-white px-[10px] py-[5px]">
                        Page {currentPage} / {totalPages}
                    </span>
                    <button
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="text-[24px] leading-none font-bold text-black/30 disabled:opacity-0 active:text-black/60 transition-opacity"
                        aria-label="Next page"
                    >
                        ›
                    </button>
                </div>
            )}

            {/* ── Add Product (floating chip) ── */}
            <Link
                href="/admin/products/new"
                className="fixed bottom-5 right-5 bg-white pl-[10px] pr-[12px] py-[7px] flex items-center gap-[6px] shadow-sm z-[70]"
            >
                <span className="text-[13px] leading-none">+</span>
                <span className="font-reformat text-[9px] font-bold tracking-[0.1em] uppercase">
                    Add Product
                </span>
            </Link>
        </div>
    )
}
