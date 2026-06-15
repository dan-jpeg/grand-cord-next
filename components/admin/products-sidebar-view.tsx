'use client'

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import { flushSync } from 'react-dom'
import Link from 'next/link'
import { AdminNav } from './admin-nav'
import { ProductForm } from './product-form'
import { getProductDetail } from '@/app/admin/products-split/actions'
import { STOCK_THRESHOLDS, STOCK_COLORS } from '@/lib/constants'
import { matchesProductSearch } from '@/lib/product-search'
import type {
    Product,
    ProductSize,
    Order,
    OrderItem,
    InventoryChangeLog,
} from '@prisma/client'

type ProductWithSizes = Product & { sizes: ProductSize[] }
type OrderWithItems = Order & { items: OrderItem[] }
type StockFilter = 'ALL' | 'IN_STOCK' | 'LOW_STOCK' | 'NO_STOCK' | 'UNPUBLISHED'
type SidebarState = 'collapsed' | 'open' | 'expanded'

const STATES: SidebarState[] = ['collapsed', 'open', 'expanded']

function statusOf(p: ProductWithSizes): Exclude<StockFilter, 'ALL'> {
    const avail = p.sizes.reduce((s, sz) => s + sz.available, 0)
    if (!p.published) return 'UNPUBLISHED'
    if (avail === 0) return 'NO_STOCK'
    if (avail <= STOCK_THRESHOLDS.LOW_STOCK) return 'LOW_STOCK'
    return 'IN_STOCK'
}

function getImages(p: ProductWithSizes): { url: string }[] {
    const raw = p.images as unknown
    if (!Array.isArray(raw)) return []
    return raw.filter(
        (img): img is { url: string } =>
            typeof img === 'object' && img !== null && typeof (img as { url?: unknown }).url === 'string',
    )
}

function primaryImage(p: ProductWithSizes): string | undefined {
    const imgs = getImages(p)
    const cart = imgs.find((img) => (img as { isCartPrimary?: boolean }).isCartPrimary)
    return cart?.url ?? imgs[0]?.url
}

export function ProductsSidebarView({ products }: { products: ProductWithSizes[] }) {
    const [sidebarState, setSidebarState] = useState<SidebarState>('expanded')
    const [stockFilter, setStockFilter] = useState<StockFilter>('ALL')
    const [materialFilter, setMaterialFilter] = useState<string | null>(null)
    const [search, setSearch] = useState('')
    const [selectedId, setSelectedId] = useState<string | null>(null)
    const [detail, setDetail] = useState<{
        orders: OrderWithItems[]
        inventoryLogs: InventoryChangeLog[]
    } | null>(null)
    const [, startTransition] = useTransition()

    const materials = useMemo(() => {
        const set = new Set<string>()
        for (const p of products) if (p.material) set.add(p.material)
        return Array.from(set).sort()
    }, [products])

    const searchScoped = useMemo(() => {
        let f = products
        if (search.trim()) f = f.filter((p) => matchesProductSearch(p, search))
        if (materialFilter) f = f.filter((p) => p.material === materialFilter)
        return f
    }, [products, search, materialFilter])

    const counts = useMemo(() => {
        let inStock = 0,
            lowStock = 0,
            noStock = 0,
            unpub = 0
        for (const p of searchScoped) {
            const s = statusOf(p)
            if (s === 'IN_STOCK') inStock++
            else if (s === 'LOW_STOCK') lowStock++
            else if (s === 'NO_STOCK') noStock++
            else unpub++
        }
        return { inStock, lowStock, noStock, unpub, total: searchScoped.length }
    }, [searchScoped])

    const filtered = useMemo(() => {
        if (stockFilter === 'ALL') return searchScoped
        return searchScoped.filter((p) => statusOf(p) === stockFilter)
    }, [searchScoped, stockFilter])

    const selected = useMemo(
        () => products.find((p) => p.id === selectedId) ?? null,
        [products, selectedId],
    )

    useEffect(() => {
        if (!selectedId) {
            setDetail(null)
            return
        }
        let cancelled = false
        setDetail(null)
        startTransition(() => {
            getProductDetail(selectedId).then((d) => {
                if (!cancelled) setDetail(d)
            })
        })
        return () => {
            cancelled = true
        }
    }, [selectedId])

    // Wrap layout-morphing state changes in the browser's View Transitions API
    // so each thumbnail morphs smoothly between sidebar states.
    const withViewTransition = useCallback((fn: () => void) => {
        const doc = document as Document & {
            startViewTransition?: (cb: () => void) => unknown
        }
        if (typeof doc.startViewTransition !== 'function') {
            fn()
            return
        }
        doc.startViewTransition(() => {
            flushSync(fn)
        })
    }, [])

    const changeState = useCallback(
        (next: SidebarState) => withViewTransition(() => setSidebarState(next)),
        [withViewTransition],
    )

    const selectFromExpanded = useCallback(
        (id: string) =>
            withViewTransition(() => {
                setSelectedId(id)
                setSidebarState('open')
            }),
        [withViewTransition],
    )

    // Cycle sidebar state with [ and ]
    useEffect(() => {
        function onKey(e: KeyboardEvent) {
            const t = e.target as HTMLElement | null
            if (
                t &&
                (t.tagName === 'INPUT' ||
                    t.tagName === 'TEXTAREA' ||
                    t.isContentEditable)
            )
                return
            if (e.key === ']') {
                e.preventDefault()
                changeState(
                    STATES[(STATES.indexOf(sidebarState) + 1) % STATES.length],
                )
            } else if (e.key === '[') {
                e.preventDefault()
                changeState(
                    STATES[
                        (STATES.indexOf(sidebarState) - 1 + STATES.length) %
                            STATES.length
                    ],
                )
            }
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [changeState, sidebarState])

    const selectedImg = selected ? primaryImage(selected) : undefined
    const showDetail = sidebarState !== 'expanded' && !!selected

    // Sidebar width per state (used for the layout grid template).
    const sidebarWidth =
        sidebarState === 'collapsed'
            ? 56
            : sidebarState === 'open'
              ? 480
              : null // expanded = full width

    return (
        <div className="absolute inset-0 bg-white overflow-hidden flex flex-col font-inter">
            <style>{`
                /* Use a real CSS animation on the sidebar content keyed by
                   state — far more reliable than ::view-transition-* in this
                   layout because the whole DOM tree re-mounts on state change. */
                @keyframes rowFadeUp {
                    from { opacity: 0; transform: translateY(10px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
                .row-stagger > * {
                    animation: rowFadeUp 360ms cubic-bezier(0.22, 1, 0.36, 1) both;
                    opacity: 0;
                }
                /* Slow-blinking indicator dot under the selected thumbnail. */
                @keyframes selectedBlink {
                    0%, 49.99%   { opacity: 1; }
                    50%, 99.99%  { opacity: 0; }
                }
                .selected-indicator {
                    animation: selectedBlink 1400ms steps(1, end) infinite;
                }
                /* Suppress the default root crossfade so it doesn't conflict
                   with the per-content animation above. */
                ::view-transition-old(root),
                ::view-transition-new(root) {
                    animation: none !important;
                    mix-blend-mode: normal;
                }
                /* Divider waits for items to settle before sliding. */
                ::view-transition-group(sidebar-divider) {
                    animation-duration: 620ms;
                    animation-delay: 200ms;
                    animation-timing-function: cubic-bezier(0.32, 1.04, 0.5, 1);
                    animation-fill-mode: both;
                }
            `}</style>
            <AdminNav
                active="inventory"
                variant="top-left"
                topClass="top-[14px]"
                leftClass="left-[18px]"
            />

            {/* Stock / Photos toggle — anchored right of sidebar in collapsed/open,
                centered at the top of the viewport in expanded mode. */}
            <div
                className="hidden md:flex absolute top-[14px] z-[300] items-center gap-[52px] text-[8pt] font-bold"
                style={
                    sidebarWidth === null
                        ? { left: '50%', transform: 'translateX(-50%)' }
                        : { right: `calc(100% - ${sidebarWidth}px + 18px)` }
                }
            >
                <Link
                    href="/admin/products"
                    className="opacity-60 hover:opacity-100 px-[6px] py-[2px] rounded-[2px]"
                >
                    Stock
                </Link>
                <span className="px-[6px] py-[2px] rounded-[2px] bg-[#d9d9d9]">
                    Photos
                </span>
            </div>

            {/* 8x8 black box — top-right corner: jump to fully expanded mode */}
            <button
                type="button"
                onClick={() => changeState('expanded')}
                title="Expand"
                className="absolute top-[10px] right-4 z-[300] w-[8px] h-[8px] bg-black hover:opacity-70"
            />

            {/* 8x8 black box — center of sidebar's right edge: expand to fullscreen */}
            {sidebarWidth !== null && (
                <button
                    type="button"
                    onClick={() => changeState('expanded')}
                    title="Expand"
                    className="absolute z-[300] w-[8px] h-[8px] bg-black hover:opacity-70 -translate-y-1/2 -translate-x-1/2"
                    style={{ left: `${sidebarWidth}px`, top: '50%' }}
                />
            )}

            {/* Vertical divider — absolute so it can translate across the screen
                as a view-transition shared element. */}
            <div
                className="absolute top-0 bottom-0 w-[2px] bg-black z-[5] pointer-events-none"
                style={
                    {
                        // In expanded mode the line slides off to the LEFT
                        // (past the viewport edge) AND fades out so the
                        // layout reads as having no divider, not as the line
                        // stuck at the right edge.
                        left: sidebarWidth === null ? '-4px' : `${sidebarWidth}px`,
                        opacity: sidebarWidth === null ? 0 : 1,
                        transition:
                            'opacity 460ms cubic-bezier(0.4, 0, 0.2, 1) 200ms',
                        viewTransitionName: 'sidebar-divider',
                    } as React.CSSProperties
                }
            />

            {/* Main grid — extends from top of screen. */}
            <div
                className="flex-1 grid overflow-hidden"
                style={{
                    gridTemplateColumns:
                        sidebarWidth === null
                            ? '1fr'
                            : `${sidebarWidth}px 1fr`,
                }}
            >
                {/* ── SIDEBAR ────────────────────────────────────────────── */}
                <aside className="overflow-hidden border-t-2 border-black mt-[40px]">
                    {sidebarState === 'collapsed' && (
                        <CollapsedSidebar
                            products={filtered}
                            selectedId={selectedId}
                            onSelect={setSelectedId}
                            onExpand={() => setSidebarState('open')}
                        />
                    )}
                    {sidebarState === 'open' && (
                        <OpenSidebar
                            products={filtered}
                            materials={materials}
                            materialFilter={materialFilter}
                            setMaterialFilter={setMaterialFilter}
                            stockFilter={stockFilter}
                            setStockFilter={setStockFilter}
                            counts={counts}
                            totalProducts={products.length}
                            search={search}
                            setSearch={setSearch}
                            selectedId={selectedId}
                            onSelect={setSelectedId}
                        />
                    )}
                    {sidebarState === 'expanded' && (
                        <ExpandedSidebar
                            products={filtered}
                            materials={materials}
                            materialFilter={materialFilter}
                            setMaterialFilter={setMaterialFilter}
                            stockFilter={stockFilter}
                            setStockFilter={setStockFilter}
                            counts={counts}
                            totalProducts={products.length}
                            search={search}
                            setSearch={setSearch}
                            selectedId={selectedId}
                            onSelect={selectFromExpanded}
                        />
                    )}
                </aside>


                {/* ── DETAIL ─────────────────────────────────────────────── */}
                {sidebarWidth !== null && (
                    <main className="relative overflow-y-auto">
                        {!showDetail && (
                            <div className="h-full flex items-center justify-center text-[10px] tracking-[0.1em] uppercase opacity-40">
                                Select a product
                            </div>
                        )}
                        {showDetail && selected && (
                            <div className="min-h-full flex flex-col items-center py-16 px-8">
                                {selectedImg && (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        src={selectedImg}
                                        alt={selected.name}
                                        className="max-h-[60vh] w-auto object-contain mb-8"
                                        draggable={false}
                                    />
                                )}
                                <div className="w-full max-w-2xl bg-white text-[0.8em]">
                                    <ProductForm
                                        key={selected.id}
                                        product={selected}
                                        orders={detail?.orders ?? []}
                                        inventoryLogs={detail?.inventoryLogs ?? []}
                                        hidePreview
                                    />
                                </div>
                            </div>
                        )}
                    </main>
                )}
            </div>
        </div>
    )
}

// ─── Collapsed sidebar ───────────────────────────────────────────────────
function CollapsedSidebar({
    products,
    selectedId,
    onSelect,
    onExpand,
}: {
    products: ProductWithSizes[]
    selectedId: string | null
    onSelect: (id: string) => void
    onExpand: () => void
}) {
    return (
        <div className="h-full overflow-y-auto pt-6 pb-4 flex flex-col items-center gap-3">
            {products.map((p) => {
                const src = primaryImage(p)
                const isSelected = p.id === selectedId
                return (
                    <button
                        key={p.id}
                        type="button"
                        onClick={() => onSelect(p.id)}
                        title={p.name}
                        className="group relative w-[36px] h-[48px] flex items-center justify-center transition-opacity hover:opacity-100"
                        style={
                            {
                                opacity: isSelected ? 1 : 0.5,
                            } as React.CSSProperties
                        }
                    >
                        {isSelected ? (
                            <span
                                aria-hidden
                                className="selected-indicator absolute left-1/2 -translate-x-1/2 -bottom-[6px] w-[4px] h-[4px] rounded-full bg-black"
                            />
                        ) : (
                            <span
                                aria-hidden
                                className="absolute left-1/2 -translate-x-1/2 -bottom-[6px] w-[4px] h-[4px] rounded-full bg-neutral-400 opacity-0 group-hover:opacity-100 transition-opacity"
                            />
                        )}
                        {src ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                src={src}
                                alt={p.name}
                                draggable={false}
                                className="max-h-full max-w-full object-contain"
                            />
                        ) : (
                            <span className="text-neutral-300 text-[6pt]">—</span>
                        )}
                    </button>
                )
            })}
            <button
                type="button"
                onClick={onExpand}
                className="mt-3 text-[10px] tracking-[0.1em] uppercase opacity-50 hover:opacity-100"
                title="Open sidebar"
            >
                ▸
            </button>
        </div>
    )
}

// ─── Open sidebar (matches Figma "open" design) ─────────────────────────
function OpenSidebar({
    products,
    materials,
    materialFilter,
    setMaterialFilter,
    stockFilter,
    setStockFilter,
    counts,
    totalProducts,
    search,
    setSearch,
    selectedId,
    onSelect,
}: {
    products: ProductWithSizes[]
    materials: string[]
    materialFilter: string | null
    setMaterialFilter: (m: string | null) => void
    stockFilter: StockFilter
    setStockFilter: (s: StockFilter) => void
    counts: { inStock: number; lowStock: number; noStock: number; unpub: number; total: number }
    totalProducts: number
    search: string
    setSearch: (s: string) => void
    selectedId: string | null
    onSelect: (id: string) => void
}) {
    return (
        <div className="h-full relative">
            {/* Material header + list — absolutely positioned overlay so the
                scroll container behind it reaches all the way to the top line. */}
            <div className="absolute top-[24px] left-[18px] z-[5]">
                <p className="text-[12px] font-bold leading-[1.4] opacity-40">
                    Material
                </p>
                <MaterialList
                    materials={materials}
                    materialFilter={materialFilter}
                    setMaterialFilter={setMaterialFilter}
                />
            </div>

            {/* Thumbnail grid — scrolls from the very top of the sidebar */}
            <div className="h-full overflow-y-auto pt-[160px] px-[18px] pb-64">
                <div className="grid grid-cols-3 gap-x-2 gap-y-20 items-end row-stagger">
                    {products.map((p, i) => {
                        const src = primaryImage(p)
                        const isSelected = p.id === selectedId
                        return (
                            <button
                                key={p.id}
                                type="button"
                                onClick={() => onSelect(p.id)}
                                title={p.name}
                                className="group relative flex items-end justify-center h-[90px] transition-opacity hover:opacity-100"
                                style={
                                    {
                                        opacity: isSelected ? 1 : 0.5,
                                        animationDelay: `${Math.floor(i / 3) * 90}ms`,
                                    } as React.CSSProperties
                                }
                            >
                                {isSelected ? (
                                    <span
                                        aria-hidden
                                        className="selected-indicator absolute left-1/2 -translate-x-1/2 -bottom-[10px] w-[5px] h-[5px] rounded-full bg-black"
                                    />
                                ) : (
                                    <span
                                        aria-hidden
                                        className="absolute left-1/2 -translate-x-1/2 -bottom-[10px] w-[5px] h-[5px] rounded-full bg-neutral-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                    />
                                )}
                                {src ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        src={src}
                                        alt={p.name}
                                        draggable={false}
                                        className="max-h-full max-w-full object-contain"
                                    />
                                ) : (
                                    <span className="text-neutral-300 text-[7pt]">
                                        —
                                    </span>
                                )}
                            </button>
                        )
                    })}
                </div>
                {products.length === 0 && (
                    <p className="px-2 py-8 text-center text-[10px] tracking-[0.1em] uppercase opacity-50">
                        No products
                    </p>
                )}
            </div>

            {/* Stock filter row — pinned to the bottom of the sidebar */}
            <div className="absolute bottom-6 left-[18px] right-[18px] z-[5] bg-white flex items-center gap-4 flex-wrap font-reformat text-[10px] uppercase tracking-[0.05em]">
                <StockFilterChip
                    label={`All${counts.total !== totalProducts ? ` · ${counts.total}` : ''}`}
                    active={stockFilter === 'ALL'}
                    onClick={() => setStockFilter('ALL')}
                />
                <StockFilterChip
                    label={`${counts.inStock} In Stock`}
                    dot={STOCK_COLORS.IN_STOCK}
                    active={stockFilter === 'IN_STOCK'}
                    onClick={() =>
                        setStockFilter(stockFilter === 'IN_STOCK' ? 'ALL' : 'IN_STOCK')
                    }
                />
                <StockFilterChip
                    label={`${counts.lowStock} Low`}
                    dot={STOCK_COLORS.LOW_STOCK}
                    active={stockFilter === 'LOW_STOCK'}
                    onClick={() =>
                        setStockFilter(stockFilter === 'LOW_STOCK' ? 'ALL' : 'LOW_STOCK')
                    }
                />
                <StockFilterChip
                    label={`${counts.noStock} Out`}
                    dot={STOCK_COLORS.NO_STOCK}
                    active={stockFilter === 'NO_STOCK'}
                    onClick={() =>
                        setStockFilter(stockFilter === 'NO_STOCK' ? 'ALL' : 'NO_STOCK')
                    }
                />
                <StockFilterChip
                    label={`${counts.unpub} Unpublished`}
                    dot="#ffffff"
                    bordered
                    active={stockFilter === 'UNPUBLISHED'}
                    onClick={() =>
                        setStockFilter(
                            stockFilter === 'UNPUBLISHED' ? 'ALL' : 'UNPUBLISHED',
                        )
                    }
                />
            </div>
        </div>
    )
}

// ─── Expanded sidebar (fills the viewport) ───────────────────────────────
function ExpandedSidebar({
    products,
    materials,
    materialFilter,
    setMaterialFilter,
    stockFilter,
    setStockFilter,
    counts,
    totalProducts,
    search,
    setSearch,
    selectedId,
    onSelect,
}: {
    products: ProductWithSizes[]
    materials: string[]
    materialFilter: string | null
    setMaterialFilter: (m: string | null) => void
    stockFilter: StockFilter
    setStockFilter: (s: StockFilter) => void
    counts: { inStock: number; lowStock: number; noStock: number; unpub: number; total: number }
    totalProducts: number
    search: string
    setSearch: (s: string) => void
    selectedId: string | null
    onSelect: (id: string) => void
}) {
    return (
        <div className="h-full flex flex-col relative">
            {/* Material list — same position as the OpenSidebar (top-left). */}
            <div className="absolute top-[24px] left-[18px] z-[5]">
                <p className="text-[12px] font-bold leading-[1.4] opacity-40">
                    Material
                </p>
                <MaterialList
                    materials={materials}
                    materialFilter={materialFilter}
                    setMaterialFilter={setMaterialFilter}
                />
            </div>

            {/* Big grid — 3 columns full width, 190px rows, lots of white space */}
            <div className="flex-1 overflow-y-auto pt-20">
                <div className="grid grid-cols-3 w-full row-stagger">
                    {products.map((p, i) => {
                        const src = primaryImage(p)
                        const isSelected = p.id === selectedId
                        return (
                            <button
                                key={p.id}
                                type="button"
                                onClick={() => onSelect(p.id)}
                                title={p.name}
                                className="group relative flex items-center justify-center transition-opacity hover:opacity-100"
                                style={
                                    {
                                        height: '260px',
                                        opacity: isSelected ? 1 : 0.5,
                                        animationDelay: `${Math.floor(i / 3) * 90}ms`,
                                    } as React.CSSProperties
                                }
                            >
                                {isSelected ? (
                                    <span
                                        aria-hidden
                                        className="selected-indicator absolute left-1/2 -translate-x-1/2 bottom-[36px] w-[6px] h-[6px] rounded-full bg-black"
                                    />
                                ) : (
                                    <span
                                        aria-hidden
                                        className="absolute left-1/2 -translate-x-1/2 bottom-[36px] w-[6px] h-[6px] rounded-full bg-neutral-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                    />
                                )}
                                {src ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        src={src}
                                        alt={p.name}
                                        draggable={false}
                                        className="object-contain"
                                        style={{ maxHeight: '130px', maxWidth: '32%' }}
                                    />
                                ) : (
                                    <span className="text-neutral-300 text-[8pt]">
                                        —
                                    </span>
                                )}
                            </button>
                        )
                    })}
                </div>
                {products.length === 0 && (
                    <p className="px-2 py-20 text-center text-[10px] tracking-[0.1em] uppercase opacity-50">
                        No products match
                    </p>
                )}
            </div>

            {/* Stock filter row at bottom */}
            <div className="flex-none px-12 pb-6 pt-2 flex items-center gap-6 flex-wrap font-reformat text-[11px] uppercase tracking-[0.05em]">
                <StockFilterChip
                    label={`All${counts.total !== totalProducts ? ` · ${counts.total}` : ''}`}
                    active={stockFilter === 'ALL'}
                    onClick={() => setStockFilter('ALL')}
                />
                <StockFilterChip
                    label={`${counts.inStock} In Stock`}
                    dot={STOCK_COLORS.IN_STOCK}
                    active={stockFilter === 'IN_STOCK'}
                    onClick={() =>
                        setStockFilter(stockFilter === 'IN_STOCK' ? 'ALL' : 'IN_STOCK')
                    }
                />
                <StockFilterChip
                    label={`${counts.lowStock} Low`}
                    dot={STOCK_COLORS.LOW_STOCK}
                    active={stockFilter === 'LOW_STOCK'}
                    onClick={() =>
                        setStockFilter(stockFilter === 'LOW_STOCK' ? 'ALL' : 'LOW_STOCK')
                    }
                />
                <StockFilterChip
                    label={`${counts.noStock} Out`}
                    dot={STOCK_COLORS.NO_STOCK}
                    active={stockFilter === 'NO_STOCK'}
                    onClick={() =>
                        setStockFilter(stockFilter === 'NO_STOCK' ? 'ALL' : 'NO_STOCK')
                    }
                />
                <StockFilterChip
                    label={`${counts.unpub} Unpublished`}
                    dot="#ffffff"
                    bordered
                    active={stockFilter === 'UNPUBLISHED'}
                    onClick={() =>
                        setStockFilter(
                            stockFilter === 'UNPUBLISHED' ? 'ALL' : 'UNPUBLISHED',
                        )
                    }
                />
            </div>
        </div>
    )
}

function StockFilterChip({
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

function MaterialList({
    materials,
    materialFilter,
    setMaterialFilter,
}: {
    materials: string[]
    materialFilter: string | null
    setMaterialFilter: (m: string | null) => void
}) {
    const [showAll, setShowAll] = useState(false)
    const visible = showAll ? materials : materials.slice(0, 3)
    const hasMore = materials.length > 3
    return (
        <>
            {visible.map((m) => {
                const active = materialFilter === m
                return (
                    <button
                        key={m}
                        type="button"
                        onClick={() => setMaterialFilter(active ? null : m)}
                        className={`block text-[12px] font-bold leading-[1.4] ${
                            active ? 'underline underline-offset-2' : 'hover:underline'
                        }`}
                    >
                        {m}
                    </button>
                )
            })}
            {hasMore && !showAll && (
                <button
                    type="button"
                    onClick={() => setShowAll(true)}
                    title={`Show all ${materials.length} materials`}
                    className="block text-[12px] font-bold leading-[1.4] opacity-60 hover:opacity-100"
                >
                    +
                </button>
            )}
        </>
    )
}
