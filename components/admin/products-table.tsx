'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { ProductStockCard } from './product-stock-card'
import { STOCK_THRESHOLDS, STOCK_COLORS } from '@/lib/constants'
import type { Product, ProductSize } from '@prisma/client'
import { matchesProductSearch } from '@/lib/product-search'
import { formatDesignerNames } from '@/lib/designers'

const VIEW_COUNT = 5
const ZOOM_STEP = 1.6
const BASE_PHOTO_HEIGHT = 90
const AMBIENT_PX_PER_FRAME = 0.35
const USER_SCROLL_QUIET_MS = 280

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

// Renders children into <body>, escaping the page's custom scroll container
// (`absolute inset-0 overflow-auto`). On iOS Safari a `position: fixed` element
// nested inside such a scroller gets trapped and scrolls with it; portaling to
// body keeps it truly pinned to the viewport (same as the top-level AdminNav).
function BodyPortal({ children }: { children: React.ReactNode }) {
    const [mounted, setMounted] = useState(false)
    useEffect(() => setMounted(true), [])
    if (!mounted) return null
    return createPortal(children, document.body)
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

    if (viewMode === 'photo') {
        return (
            <PhotosView
                products={filteredProducts}
                totalCount={products.length}
                counts={counts}
                stockFilter={stockFilter}
                onSelectFilter={(f) => {
                    setStockFilter(f)
                    setCurrentPage(1)
                }}
                onSwitchToStock={() => setViewMode('stock')}
            />
        )
    }

    const filterChips = (
        <>
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
        </>
    )

    return (
        <div className="w-full max-w-screen-md mx-auto pt-3 pb-40 md:pb-16">
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
                                style={{ opacity: 1 }}
                            >
                                Stock
                            </button>
                            <button
                                type="button"
                                onClick={() => setViewMode('photo')}
                                className="font-alte text-[36px] leading-none tracking-[-0.03em] text-black transition-opacity active:opacity-60"
                                style={{ opacity: 0.18 }}
                            >
                                Photos
                            </button>
                        </>
                    )}
                </div>

                {/* Filter chips — desktop only; on mobile these live in the fixed
                    bottom bar (see below) so they stay pinned instead of scrolling. */}
                <div className="hidden md:flex gap-[6px] overflow-x-auto [&::-webkit-scrollbar]:hidden">
                    {filterChips}
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-[1px] bg-[#e8e8e8]">
                    {paginatedProducts.map((product) => (
                        <ProductStockCard key={product.id} product={product} />
                    ))}
                </div>
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

            {/* ── Mobile fixed bottom bar — Stock/Photos toggle + status chips,
                pinned to the viewport so they never scroll away. ── */}
            {isMobile && (
                <BodyPortal>
                    <div className="fixed bottom-0 left-0 right-0 z-[65] bg-white/95 backdrop-blur-sm px-4 pt-3 pb-5 flex flex-col gap-3">
                        <div className="flex gap-[6px] overflow-x-auto [&::-webkit-scrollbar]:hidden">
                            {filterChips}
                        </div>
                        <div className="flex gap-[24px] font-alte text-[16px] leading-none tracking-[-0.03em] text-black">
                            <button
                                type="button"
                                onClick={() => setViewMode('stock')}
                                style={{ opacity: 1 }}
                            >
                                Stock
                            </button>
                            <button
                                type="button"
                                onClick={() => setViewMode('photo')}
                                style={{ opacity: 0.18 }}
                            >
                                Photos
                            </button>
                        </div>
                    </div>
                </BodyPortal>
            )}

            {/* ── New Item (floating pill) ── */}
            <Link
                href="/admin/products/new"
                className="fixed bottom-5 right-5 z-[70] bg-neutral-200/30 rounded-full px-3 py-1 text-[12px] font-bold opacity-40 hover:opacity-70"
            >
                New Item +
            </Link>
        </div>
    )
}

function PhotosView({
    products,
    totalCount,
    counts,
    stockFilter,
    onSelectFilter,
    onSwitchToStock,
}: {
    products: ProductWithSizes[]
    totalCount: number
    counts: { inStock: number; lowStock: number; noStock: number; unpub: number }
    stockFilter: StockFilter
    onSelectFilter: (f: StockFilter) => void
    onSwitchToStock: () => void
}) {
    const [viewIndex, setViewIndex] = useState(0) // 0..VIEW_COUNT-1
    const [hoveredProduct, setHoveredProduct] = useState<ProductWithSizes | null>(null)
    const scrollRef = useRef<HTMLDivElement>(null)

    // Z cycles through view sizes 1..5
    useEffect(() => {
        function onKey(e: KeyboardEvent) {
            if (e.key !== 'z' && e.key !== 'Z') return
            const t = e.target as HTMLElement | null
            if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
            e.preventDefault()
            setViewIndex((v) => (v + 1) % VIEW_COUNT)
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [])

    const scale = Math.pow(ZOOM_STEP, viewIndex)
    const photoHeight = BASE_PHOTO_HEIGHT * scale
    const isMaxView = viewIndex === VIEW_COUNT - 1

    // Inertia-based ambient scroll at max view
    const ambientActiveRef = useRef(false)
    const lastUserScrollRef = useRef(0)
    const lastScrollLeftRef = useRef(0)
    const lastDirRef = useRef<1 | -1>(1)
    const hoverPausedRef = useRef(false)

    useEffect(() => {
        if (!isMaxView) return
        const el = scrollRef.current
        if (!el) return

        lastScrollLeftRef.current = el.scrollLeft
        lastUserScrollRef.current = performance.now()
        hoverPausedRef.current = false
        let raf = 0

        function onScroll() {
            if (!el) return
            const cur = el.scrollLeft
            const delta = cur - lastScrollLeftRef.current
            lastScrollLeftRef.current = cur
            if (!ambientActiveRef.current && delta !== 0) {
                lastDirRef.current = delta > 0 ? 1 : -1
                lastUserScrollRef.current = performance.now()
            }
        }

        function onUserInput() {
            ambientActiveRef.current = false
            lastUserScrollRef.current = performance.now()
        }

        function onPointerEnter() {
            hoverPausedRef.current = true
            ambientActiveRef.current = false
        }

        function onPointerLeave() {
            hoverPausedRef.current = false
            // Treat leaving like a fresh quiet period so ambient resumes smoothly
            lastUserScrollRef.current = performance.now()
        }

        function step() {
            if (!el) return
            const quietFor = performance.now() - lastUserScrollRef.current
            if (!hoverPausedRef.current && quietFor >= USER_SCROLL_QUIET_MS) {
                const max = el.scrollWidth - el.clientWidth
                if (max > 0) {
                    let next = el.scrollLeft + lastDirRef.current * AMBIENT_PX_PER_FRAME
                    if (next <= 0) {
                        next = 0
                        lastDirRef.current = 1
                    } else if (next >= max) {
                        next = max
                        lastDirRef.current = -1
                    }
                    ambientActiveRef.current = true
                    lastScrollLeftRef.current = next
                    el.scrollLeft = next
                }
            } else {
                ambientActiveRef.current = false
            }
            raf = requestAnimationFrame(step)
        }

        el.addEventListener('scroll', onScroll, { passive: true })
        el.addEventListener('wheel', onUserInput, { passive: true })
        el.addEventListener('touchstart', onUserInput, { passive: true })
        el.addEventListener('pointerdown', onUserInput, { passive: true })
        el.addEventListener('pointerenter', onPointerEnter)
        el.addEventListener('pointerleave', onPointerLeave)
        raf = requestAnimationFrame(step)

        return () => {
            cancelAnimationFrame(raf)
            ambientActiveRef.current = false
            hoverPausedRef.current = false
            el.removeEventListener('scroll', onScroll)
            el.removeEventListener('wheel', onUserInput)
            el.removeEventListener('touchstart', onUserInput)
            el.removeEventListener('pointerdown', onUserInput)
            el.removeEventListener('pointerenter', onPointerEnter)
            el.removeEventListener('pointerleave', onPointerLeave)
        }
    }, [isMaxView])

    // Convert wheel deltaY into horizontal scroll so trackpads + mice can drive the strip
    useEffect(() => {
        const el = scrollRef.current
        if (!el) return
        function onWheel(e: WheelEvent) {
            if (!el) return
            if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && el.scrollWidth > el.clientWidth) {
                el.scrollLeft += e.deltaY
                e.preventDefault()
            }
        }
        el.addEventListener('wheel', onWheel, { passive: false })
        return () => el.removeEventListener('wheel', onWheel)
    }, [])

    return (
        <div className="fixed inset-0 bg-white z-[200] overflow-hidden font-inter">
            {/* Top-right view indicator */}
            <p className="absolute right-4 top-[14px] text-[12px] z-[20] tabular-nums">
                view: {viewIndex + 1}
            </p>

            {/* Center Stock / Photos toggle — sits behind the photo strip. */}
            <div className="absolute left-1/2 -translate-x-1/2 top-[36%] flex gap-[44px] text-[12px] font-bold z-[5]">
                <button
                    type="button"
                    onClick={onSwitchToStock}
                    className="hover:opacity-60"
                >
                    Stock
                </button>
                <button
                    type="button"
                    className="underline underline-offset-[2px]"
                >
                    Photos
                </button>
            </div>

            {/* Horizontal photo strip — vertically centered, scrolls horizontally, layered above the toggle */}
            <div
                ref={scrollRef}
                className="absolute inset-x-0 top-1/2 -translate-y-1/2 overflow-x-auto overflow-y-hidden [&::-webkit-scrollbar]:hidden z-[10]"
                style={{ scrollbarWidth: 'none' }}
            >
                <div
                    className="flex items-center justify-center min-w-full w-max"
                    style={{
                        height: Math.max(photoHeight + 40, 200),
                        padding: `0 ${Math.max(48, photoHeight * 0.6)}px`,
                        gap: Math.max(8, 6 * scale),
                    }}
                >
                    {products.map((product) => (
                        <PhotoStripItem
                            key={product.id}
                            product={product}
                            height={photoHeight}
                            onHoverChange={(hovered) =>
                                setHoveredProduct(hovered ? product : (cur) => (cur?.id === product.id ? null : cur))
                            }
                        />
                    ))}
                </div>
            </div>

            {/* Hover info — appears centered above the bottom legend */}
            <HoverInfoOverlay product={hoveredProduct} />

            {/* Bottom-left status filters */}
            <div className="absolute left-9 bottom-6 flex items-center gap-[18px] text-[12px] uppercase font-reformat tracking-[0.04em] z-[20]">
                <PhotoFilter
                    label="All"
                    active={stockFilter === 'ALL'}
                    onClick={() => onSelectFilter('ALL')}
                />
                <PhotoFilter
                    label={`${counts.inStock} In Stock`}
                    dot={STOCK_COLORS.IN_STOCK}
                    active={stockFilter === 'IN_STOCK'}
                    onClick={() => onSelectFilter(stockFilter === 'IN_STOCK' ? 'ALL' : 'IN_STOCK')}
                />
                <PhotoFilter
                    label={`${counts.lowStock} Low`}
                    dot={STOCK_COLORS.LOW_STOCK}
                    active={stockFilter === 'LOW_STOCK'}
                    onClick={() => onSelectFilter(stockFilter === 'LOW_STOCK' ? 'ALL' : 'LOW_STOCK')}
                />
                <PhotoFilter
                    label={`${counts.noStock} Out`}
                    dot={STOCK_COLORS.NO_STOCK}
                    active={stockFilter === 'NO_STOCK'}
                    onClick={() => onSelectFilter(stockFilter === 'NO_STOCK' ? 'ALL' : 'NO_STOCK')}
                />
                <PhotoFilter
                    label={`${counts.unpub} Unpublished`}
                    dot="#ffffff"
                    bordered
                    active={stockFilter === 'UNPUBLISHED'}
                    onClick={() => onSelectFilter(stockFilter === 'UNPUBLISHED' ? 'ALL' : 'UNPUBLISHED')}
                />
                <span className="ml-2 opacity-30 normal-case tracking-normal text-[10px]">
                    {totalCount} total · Z to zoom
                </span>
            </div>

            {/* Bottom-right material legend (placeholder until material filter is wired up) */}
            <div className="absolute right-4 bottom-6 flex items-center gap-[18px] text-[12px] uppercase font-reformat tracking-[0.04em] z-[20]">
                <span className="opacity-20">Material</span>
                <button type="button" className="hover:opacity-60">Leather</button>
                <button type="button" className="hover:opacity-60">Cotton</button>
                <button type="button" className="hover:opacity-60">Wool</button>
            </div>
        </div>
    )
}

function PhotoFilter({
    label,
    dot,
    bordered,
    active,
    onClick,
}: {
    label: string
    dot?: string
    bordered?: boolean
    active: boolean
    onClick: () => void
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`inline-flex items-center gap-[6px] transition-opacity ${
                active ? '' : 'opacity-60 hover:opacity-100'
            }`}
        >
            {dot && (
                <span
                    style={{
                        display: 'inline-block',
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        backgroundColor: dot,
                        border: bordered ? '1px solid #1a1a1a' : 'none',
                        flexShrink: 0,
                    }}
                />
            )}
            <span className={active ? 'underline underline-offset-2' : ''}>{label}</span>
        </button>
    )
}

function PhotoStripItem({
    product,
    height,
    onHoverChange,
}: {
    product: ProductWithSizes
    height: number
    onHoverChange: (hovered: boolean) => void
}) {
    const raw = product.images as unknown
    const imgs = Array.isArray(raw) ? raw : []
    const isObj = (img: unknown): img is Record<string, unknown> =>
        typeof img === 'object' && img !== null
    // Admin/inventory views prefer the background-less "inventory" shot when set;
    // fall back to the cart primary and then any image.
    const inventoryImg = imgs.find(
        (img): img is { url: string } => isObj(img) && !!img.isInventoryPrimary,
    )
    const cartImg = imgs.find(
        (img): img is { url: string } => isObj(img) && !!img.isCartPrimary,
    )
    const fallback =
        isObj(imgs[0]) ? (imgs[0] as { url?: string }).url : undefined
    const src = inventoryImg?.url ?? cartImg?.url ?? fallback

    const hoverHandlers = {
        onPointerEnter: () => onHoverChange(true),
        onPointerLeave: () => onHoverChange(false),
    }

    if (!src) {
        return (
            <Link
                href={`/admin/products/${product.id}/edit`}
                className="flex items-center justify-center text-neutral-300 text-[6pt] border border-dashed border-neutral-200 flex-none"
                style={{ height, width: height * 0.6 }}
                title={product.name}
                {...hoverHandlers}
            >
                —
            </Link>
        )
    }

    return (
        <Link
            href={`/admin/products/${product.id}/edit`}
            className="block flex-none hover:opacity-80 transition-opacity"
            title={product.name}
            style={{ height }}
            {...hoverHandlers}
        >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
                src={src}
                alt={product.name}
                draggable={false}
                style={{ height: '100%', width: 'auto', objectFit: 'contain' }}
            />
        </Link>
    )
}

function HoverInfoOverlay({ product }: { product: ProductWithSizes | null }) {
    if (!product) return null
    const designerLabel = formatDesignerNames(product.designerNames)
    const totalStock = product.sizes.reduce((sum, s) => sum + s.available, 0)
    const status = statusOf(product)
    const dotColor =
        status === 'IN_STOCK'
            ? STOCK_COLORS.IN_STOCK
            : status === 'LOW_STOCK'
              ? STOCK_COLORS.LOW_STOCK
              : status === 'NO_STOCK'
                ? STOCK_COLORS.NO_STOCK
                : '#ffffff'
    return (
        <div className="absolute left-1/2 -translate-x-1/2 bottom-[72px] z-[15] flex flex-col items-center gap-[6px] pointer-events-none text-center max-w-[calc(80*var(--vw))]">
            <p className="text-[12px] font-bold tracking-tight text-black">{product.name}</p>
            {designerLabel && (
                <p className="text-[11px] font-bold tracking-tight text-black opacity-70">
                    {designerLabel}
                </p>
            )}
            <div className="flex items-center gap-[8px] font-reformat text-[10px] uppercase tracking-[0.05em]">
                <span
                    className="rounded-full"
                    style={{
                        display: 'inline-block',
                        width: 7,
                        height: 7,
                        backgroundColor: dotColor,
                        border: status === 'UNPUBLISHED' ? '1px solid #1a1a1a' : 'none',
                    }}
                />
                <span>{product.published ? `${totalStock} I/S` : 'Unpublished'}</span>
            </div>
        </div>
    )
}
