'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition } from 'react'
import { flushSync } from 'react-dom'
import Link from 'next/link'
import { AdminNav } from './admin-nav'
import { ProductForm } from './product-form'
import { getProductDetail, patchProductIdentity } from '@/app/admin/products-split/actions'
import { deleteProduct } from '@/app/admin/products/actions'
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
type ProductFormTab = 'identity' | 'look' | 'sizing' | 'listing' | 'sales' | 'history'

// Minor-third (1.2) scale anchored at L = 120px to match the existing strip.
const STRIP_SIZES: { key: 'XS' | 'S' | 'M' | 'L' | 'XL'; height: number }[] = [
    { key: 'XS', height: 70 },
    { key: 'S', height: 84 },
    { key: 'M', height: 100 },
    { key: 'L', height: 120 },
    { key: 'XL', height: 144 },
]

const PILL_TABS: { key: ProductFormTab; label: string }[] = [
    { key: 'identity', label: 'Identity' },
    { key: 'look', label: 'Look' },
    { key: 'sizing', label: 'Inventory' },
    { key: 'history', label: 'History' },
    { key: 'sales', label: 'Sales' },
    { key: 'listing', label: 'Listing' },
]

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
    const inventory = imgs.find((img) => (img as { isInventoryPrimary?: boolean }).isInventoryPrimary)
    const cart = imgs.find((img) => (img as { isCartPrimary?: boolean }).isCartPrimary)
    return inventory?.url ?? cart?.url ?? imgs[0]?.url
}

function deriveCode(p: ProductWithSizes): string {
    const src = (p.slug || p.id).replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
    return `${src.slice(-3) || '000'}W`
}


export function ProductsSplitView({ products }: { products: ProductWithSizes[] }) {
    const [stockFilter, setStockFilter] = useState<StockFilter>('ALL')
    const [search, setSearch] = useState('')
    const [selectedId, setSelectedId] = useState<string | null>(null)
    const [activeTab, setActiveTab] = useState<ProductFormTab>('identity')
    const [navDir, setNavDir] = useState<'fwd' | 'back'>('fwd')
    const [lastNavKind, setLastNavKind] = useState<'tab' | 'item'>('item')
    const [solidLine, setSolidLine] = useState(false)
    const [stripSizeIdx, setStripSizeIdx] = useState(3) // L
    const stripSize = STRIP_SIZES[stripSizeIdx]
    const [stripHovered, setStripHovered] = useState(false)
    const COLLAPSED_STRIP_HEIGHT = 14
    const [detail, setDetail] = useState<{
        orders: OrderWithItems[]
        inventoryLogs: InventoryChangeLog[]
    } | null>(null)
    const [, startTransition] = useTransition()

    // Pool of all unique searchable terms across products (for autosuggest).
    const termIndex = useMemo(() => {
        const set = new Set<string>()
        for (const p of products) {
            if (p.name) set.add(p.name)
            if (p.material) set.add(p.material)
            if (p.color) set.add(p.color)
            for (const d of p.designerNames ?? []) if (d) set.add(d)
            for (const k of p.keywords ?? []) if (k) set.add(k)
        }
        return Array.from(set)
    }, [products])

    const suggestions = useMemo(() => {
        const q = search.trim().toLowerCase()
        if (!q) return [] as string[]
        const matches = termIndex.filter((t) => t.toLowerCase().includes(q))
        // exact matches & startsWith first
        matches.sort((a, b) => {
            const al = a.toLowerCase()
            const bl = b.toLowerCase()
            const aStarts = al.startsWith(q)
            const bStarts = bl.startsWith(q)
            if (aStarts !== bStarts) return aStarts ? -1 : 1
            return al.localeCompare(bl)
        })
        // Drop the exact-match-of-search to avoid showing what's already typed
        return matches.filter((m) => m.toLowerCase() !== q).slice(0, 6)
    }, [termIndex, search])

    // Products that match the search (before applying the stock filter) — drives
    // both the visible counts and the strip after `stockFilter` narrows it.
    const searchScoped = useMemo(() => {
        if (!search.trim()) return products
        return products.filter((p) => matchesProductSearch(p, search))
    }, [products, search])

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

    const selectedImg = selected ? primaryImage(selected) : undefined

    // Wrap state changes that morph the layout (grid <-> strip) inside a
    // View Transition so the browser can crossfade & morph each thumb between
    // the two positions.
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

    const transitionToSelection = useCallback(
        (id: string | null) => {
            withViewTransition(() => setSelectedId(id))
        },
        [withViewTransition],
    )

    // ── connector geometry ─────────────────────────────────────────────
    const outerRef = useRef<HTMLDivElement>(null)
    const stripWrapRef = useRef<HTMLDivElement>(null)
    const stripScrollRef = useRef<HTMLDivElement>(null)
    const imageWrapRef = useRef<HTMLDivElement>(null)
    const selectedThumbRef = useRef<HTMLButtonElement | null>(null)
    const pathRef = useRef<SVGPathElement | null>(null)
    const svgRef = useRef<SVGSVGElement | null>(null)
    const cardBottomRef = useRef<HTMLDivElement | null>(null)
    const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({})
    const bottomSvgRef = useRef<SVGSVGElement | null>(null)
    const bottomPathRef = useRef<SVGPathElement | null>(null)

    // Compute the path d string from current DOM positions and write it
    // straight to the SVG path (bypassing React) so scrolling doesn't lag.
    const writeConnector = useCallback((suppressTransition: boolean) => {
        const wrap = stripWrapRef.current
        const thumbEl = selectedThumbRef.current
        const target = imageWrapRef.current
        const path = pathRef.current
        const svg = svgRef.current
        if (!wrap || !thumbEl || !target || !path || !svg) return
        const parent = wrap.getBoundingClientRect()
        const thumb = thumbEl.getBoundingClientRect()
        const tgt = target.getBoundingClientRect()
        const from = {
            x: thumb.left + thumb.width / 2 - parent.left,
            y: thumb.bottom - parent.top + 6,
        }
        const to = {
            x: tgt.left + tgt.width / 2 - parent.left,
            y: tgt.top - parent.top,
        }
        const midY = from.y + Math.max(24, (to.y - from.y) * 0.45)
        const d = `M ${from.x} ${from.y} L ${from.x} ${midY} L ${to.x} ${midY} L ${to.x} ${to.y}`

        if (suppressTransition) {
            path.style.transition = 'none'
        } else {
            path.style.removeProperty('transition')
        }
        path.setAttribute('d', d)
        path.style.setProperty('d', `path("${d}")`)
    }, [])

    // Bottom connector: from card-bottom into the active pill tab. Lives in the
    // outer container's coordinate space because the pill bar sits OUTSIDE the
    // scrollable strip wrapper.
    const writeBottomConnector = useCallback((suppressTransition: boolean) => {
        const outer = outerRef.current
        const cardAnchor = cardBottomRef.current
        const activeTabEl = tabRefs.current[activeTab]
        const path = bottomPathRef.current
        if (!outer || !cardAnchor || !activeTabEl || !path) return
        const parent = outer.getBoundingClientRect()
        const card = cardAnchor.getBoundingClientRect()
        const tab = activeTabEl.getBoundingClientRect()
        const from = {
            x: card.left - parent.left,
            y: card.bottom - parent.top + 6,
        }
        const to = {
            x: tab.left + tab.width / 2 - parent.left,
            y: tab.top - parent.top,
        }
        const midY = from.y + Math.max(24, (to.y - from.y) * 0.55)
        const d = `M ${from.x} ${from.y} L ${from.x} ${midY} L ${to.x} ${midY} L ${to.x} ${to.y}`

        if (suppressTransition) {
            path.style.transition = 'none'
        } else {
            path.style.removeProperty('transition')
        }
        path.setAttribute('d', d)
        path.style.setProperty('d', `path("${d}")`)
    }, [activeTab])

    // Initial / selection-change geometry (with the smooth d transition)
    useLayoutEffect(() => {
        if (!selected) return
        // animate (transition enabled) when the selection changes
        writeConnector(false)
        writeBottomConnector(false)
    }, [
        selected,
        selectedId,
        filtered.length,
        stripSizeIdx,
        stripHovered,
        activeTab,
        writeConnector,
        writeBottomConnector,
    ])

    // While the strip is expanding/collapsing, continuously update the
    // connector so it tracks the moving thumb.
    useEffect(() => {
        if (!selected) return
        let raf = 0
        const start = performance.now()
        const tick = () => {
            writeConnector(true)
            writeBottomConnector(true)
            if (performance.now() - start < 360) {
                raf = requestAnimationFrame(tick)
            } else {
                // Final settle with the transition restored
                writeConnector(false)
                writeBottomConnector(false)
            }
        }
        raf = requestAnimationFrame(tick)
        return () => cancelAnimationFrame(raf)
    }, [stripHovered, selected, writeConnector, writeBottomConnector])

    // Scroll & resize: write directly without React, no transition
    useEffect(() => {
        let rafId: number | null = null
        let restoreTimer: ReturnType<typeof setTimeout> | null = null

        const onScroll = () => {
            if (rafId !== null) return
            rafId = requestAnimationFrame(() => {
                rafId = null
                writeConnector(true) // suppress transition for direct tracking
                writeBottomConnector(true)
            })
            if (restoreTimer) clearTimeout(restoreTimer)
            restoreTimer = setTimeout(() => {
                // re-enable transition once scrolling settles
                if (pathRef.current) {
                    pathRef.current.style.removeProperty('transition')
                }
                if (bottomPathRef.current) {
                    bottomPathRef.current.style.removeProperty('transition')
                }
            }, 120)
        }
        const onResize = () => {
            writeConnector(true)
            writeBottomConnector(true)
        }

        window.addEventListener('resize', onResize)
        const wrapEl = stripWrapRef.current
        const scrollEl = stripScrollRef.current
        wrapEl?.addEventListener('scroll', onScroll, { passive: true })
        scrollEl?.addEventListener('scroll', onScroll, { passive: true })
        return () => {
            window.removeEventListener('resize', onResize)
            wrapEl?.removeEventListener('scroll', onScroll)
            scrollEl?.removeEventListener('scroll', onScroll)
            if (rafId !== null) cancelAnimationFrame(rafId)
            if (restoreTimer) clearTimeout(restoreTimer)
        }
    }, [writeConnector, writeBottomConnector])

    // ── keyboard shortcuts: Q/E page items, A/D cycle tabs ─────────────
    useEffect(() => {
        function onKey(e: KeyboardEvent) {
            const t = e.target as HTMLElement | null
            if (
                t &&
                (t.tagName === 'INPUT' ||
                    t.tagName === 'TEXTAREA' ||
                    t.isContentEditable)
            ) {
                return
            }
            const k = e.key.toLowerCase()
            if (k === 'q' || k === 'e') {
                if (filtered.length === 0) return
                e.preventDefault()
                const curIdx = selectedId
                    ? filtered.findIndex((p) => p.id === selectedId)
                    : -1
                const dir = k === 'e' ? 1 : -1
                const next =
                    curIdx === -1
                        ? dir === 1
                            ? 0
                            : filtered.length - 1
                        : (curIdx + dir + filtered.length) % filtered.length
                setNavDir(dir === 1 ? 'fwd' : 'back')
                setLastNavKind('item')
                const fromGrid = curIdx === -1
                if (fromGrid) transitionToSelection(filtered[next].id)
                else setSelectedId(filtered[next].id)
                return
            }
            if (k === 'a' || k === 'd') {
                e.preventDefault()
                const curIdx = PILL_TABS.findIndex((p) => p.key === activeTab)
                const dir = k === 'd' ? 1 : -1
                const next = (curIdx + dir + PILL_TABS.length) % PILL_TABS.length
                setNavDir(dir === 1 ? 'fwd' : 'back')
                setLastNavKind('tab')
                setActiveTab(PILL_TABS[next].key)
                return
            }
            if (k === 'l') {
                e.preventDefault()
                setSolidLine((s) => !s)
                return
            }
            if (k === 'z') {
                e.preventDefault()
                setStripSizeIdx((i) => (i + 1) % STRIP_SIZES.length)
                return
            }
            if (e.key === 'Escape') {
                if (selectedId) {
                    e.preventDefault()
                    transitionToSelection(null)
                }
            }
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [filtered, selectedId, activeTab, transitionToSelection])

    // ── identity field editing ─────────────────────────────────────────
    const [savePending, startSave] = useTransition()
    const saveField = useCallback(
        (patch: Parameters<typeof patchProductIdentity>[1]) => {
            if (!selectedId) return
            startSave(() => {
                patchProductIdentity(selectedId, patch).catch(() => {})
            })
        },
        [selectedId],
    )

    return (
        <div ref={outerRef} className="absolute inset-0 bg-white overflow-hidden flex flex-col">
            <style>{`
                @keyframes splitTabFadeInFwd {
                    from { opacity: 0; transform: translate(6px, 12px); }
                    to   { opacity: 1; transform: translate(0, 0); }
                }
                @keyframes splitTabFadeInBack {
                    from { opacity: 0; transform: translate(-6px, -12px); }
                    to   { opacity: 1; transform: translate(0, 0); }
                }
                /* Subtle spring: slight overshoot, motion + fade run together
                   (no separate hold-then-snap stage). */
                .split-tab-anim-fwd {
                    animation: splitTabFadeInFwd 520ms cubic-bezier(0.34, 1.42, 0.64, 1) both;
                }
                .split-tab-anim-back {
                    animation: splitTabFadeInBack 520ms cubic-bezier(0.34, 1.42, 0.64, 1) both;
                }
                /* Item-change: same fade duration, no translate. */
                @keyframes splitFadeOnly {
                    from { opacity: 0; }
                    to   { opacity: 1; }
                }
                .split-item-fade {
                    animation: splitFadeOnly 520ms cubic-bezier(0.22, 1, 0.36, 1) both;
                }
                /* Item-change stagger: each direct child of the identity card
                   fades + slides in on its own, with a small cascade. */
                @keyframes fieldEnter {
                    from { opacity: 0; transform: translateY(6px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
                .value-stagger > * {
                    animation: fieldEnter 320ms cubic-bezier(0.22, 1, 0.36, 1) both;
                }
                .value-stagger > *:nth-child(1) { animation-delay: 0ms; }
                .value-stagger > *:nth-child(2) { animation-delay: 60ms; }
                .value-stagger > *:nth-child(3) { animation-delay: 120ms; }
                .value-stagger > *:nth-child(4) { animation-delay: 180ms; }
                .value-stagger > *:nth-child(5) { animation-delay: 240ms; }
                @keyframes digitRoll {
                    from { opacity: 0; transform: translateY(8px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
                .animated-digit {
                    animation: digitRoll 320ms cubic-bezier(0.22, 1, 0.36, 1) both;
                }
                @keyframes connectorFadeIn {
                    0%   { opacity: 0; stroke-dashoffset: 60; }
                    40%  { opacity: 0; }
                    100% { opacity: 1; stroke-dashoffset: 0; }
                }
                @keyframes connectorMarch {
                    to { stroke-dashoffset: -16; }
                }
                .connector-svg {
                    animation: connectorFadeIn 600ms cubic-bezier(0.22, 1, 0.36, 1) both;
                }
                .connector-path {
                    /* d transitions only work in modern Chromium/WebKit, but
                       degrades gracefully — it will just snap on older browsers. */
                    transition: d 380ms cubic-bezier(0.22, 1, 0.36, 1);
                    animation: connectorMarch 2.4s linear infinite;
                }
                .connector-path-solid {
                    transition: d 380ms cubic-bezier(0.22, 1, 0.36, 1);
                }
                /* Smooth out the browser-native View Transition for layout swap. */
                ::view-transition-old(root),
                ::view-transition-new(root) {
                    animation-duration: 360ms;
                    animation-timing-function: cubic-bezier(0.22, 1, 0.36, 1);
                }
            `}</style>
            <AdminNav active="inventory" variant="top-left" />

            {/* Bottom dashed connector: card-bottom → active tab in pill */}
            {selected && (
                <svg
                    ref={bottomSvgRef}
                    aria-hidden
                    className="absolute inset-0 pointer-events-none z-[5] connector-svg"
                    width="100%"
                    height="100%"
                    style={{ overflow: 'visible' }}
                >
                    <path
                        ref={bottomPathRef}
                        className={solidLine ? 'connector-path-solid' : 'connector-path'}
                        fill="none"
                        stroke="#525252"
                        strokeWidth="1"
                        strokeDasharray={solidLine ? undefined : '4 4'}
                    />
                </svg>
            )}

            {/* Stock / Photos centered toggle + view counter */}
            <div className="relative flex-none pt-3 pb-1">
                <div className="flex justify-center gap-[24px] text-[12px] font-bold">
                    <Link href="/admin/products" className="hover:opacity-60 opacity-60">
                        Stock
                    </Link>
                    <span className="underline underline-offset-[3px]">Photos</span>
                </div>
                <p className="absolute right-4 top-[14px] text-[12px] tabular-nums opacity-80">
                    view: {stripSize.key}
                </p>
            </div>

            {/* Search (left) + filter chips (right) — single row */}
            <div className="flex-none pt-12 px-3 pb-2 flex items-center justify-between gap-8 text-[8pt]">
                {/* Search left */}
                <div className="relative flex-1 min-w-0">
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="absolute inset-0 opacity-0 cursor-default z-0"
                        autoFocus
                    />
                    <div className="pointer-events-none relative z-10">
                        {search ? (
                            <div className="inline-flex items-baseline gap-1 flex-wrap">
                                <span className="font-bold pointer-events-none">
                                    ■ &apos;{search}&apos;
                                </span>
                                {suggestions.map((s) => (
                                    <span key={s} className="opacity-60">
                                        <span className="opacity-60 mx-1">;</span>
                                        <button
                                            type="button"
                                            onClick={() => setSearch(s)}
                                            className="pointer-events-auto hover:opacity-100 hover:underline underline-offset-2"
                                        >
                                            &apos;{s}&apos;
                                        </button>
                                    </span>
                                ))}
                            </div>
                        ) : (
                            <div className="opacity-50 pointer-events-none">
                                ■ Start Typing to Search By Order Number or Order E-Mail
                            </div>
                        )}
                    </div>
                </div>

                {/* Filter chips right */}
                <div className="flex items-center gap-5 flex-wrap font-reformat text-[12px] uppercase tracking-[0.04em]">
                    <FilterChip
                        label={
                            counts.total !== products.length ? (
                                <>
                                    All · <AnimatedNumber value={counts.total} />
                                </>
                            ) : (
                                'All'
                            )
                        }
                        active={stockFilter === 'ALL'}
                        onClick={() => setStockFilter('ALL')}
                    />
                    <FilterChip
                        label={
                            <>
                                <AnimatedNumber value={counts.inStock} /> In Stock
                            </>
                        }
                        dot={STOCK_COLORS.IN_STOCK}
                        active={stockFilter === 'IN_STOCK'}
                        onClick={() =>
                            setStockFilter((s) => (s === 'IN_STOCK' ? 'ALL' : 'IN_STOCK'))
                        }
                    />
                    <FilterChip
                        label={
                            <>
                                <AnimatedNumber value={counts.lowStock} /> Low
                            </>
                        }
                        dot={STOCK_COLORS.LOW_STOCK}
                        active={stockFilter === 'LOW_STOCK'}
                        onClick={() =>
                            setStockFilter((s) => (s === 'LOW_STOCK' ? 'ALL' : 'LOW_STOCK'))
                        }
                    />
                    <FilterChip
                        label={
                            <>
                                <AnimatedNumber value={counts.noStock} /> Out
                            </>
                        }
                        dot={STOCK_COLORS.NO_STOCK}
                        active={stockFilter === 'NO_STOCK'}
                        onClick={() =>
                            setStockFilter((s) => (s === 'NO_STOCK' ? 'ALL' : 'NO_STOCK'))
                        }
                    />
                    <FilterChip
                        label={
                            <>
                                <AnimatedNumber value={counts.unpub} /> Unpublished
                            </>
                        }
                        dot="#ffffff"
                        bordered
                        active={stockFilter === 'UNPUBLISHED'}
                        onClick={() =>
                            setStockFilter((s) =>
                                s === 'UNPUBLISHED' ? 'ALL' : 'UNPUBLISHED',
                            )
                        }
                    />
    x`                </div>
            </div>

            {/* Strip + detail wrapped together so we can draw the connector across both */}
            <div
                ref={stripWrapRef}
                className="flex-1 overflow-y-auto pb-32 relative"
            >
                {/* SVG connector overlay */}
                {selected && filtered.some((p) => p.id === selected.id) && (
                    <svg
                        ref={svgRef}
                        aria-hidden
                        className="absolute inset-0 pointer-events-none z-[5] connector-svg"
                        width="100%"
                        height="100%"
                        style={{ overflow: 'visible' }}
                    >
                        <path
                            ref={pathRef}
                            className={solidLine ? 'connector-path-solid' : 'connector-path'}
                            fill="none"
                            stroke="#525252"
                            strokeWidth="1"
                            strokeDasharray={solidLine ? undefined : '4 4'}
                        />
                    </svg>
                )}

                {/* Grid view (no selection) */}
                {!selected && (
                    <div className="mx-auto max-w-5xl px-8 pt-16">
                        <div className="grid grid-cols-6 gap-x-1 gap-y-0ne items-end justify-items-center">
                            {filtered.map((p) => {
                                const src = primaryImage(p)
                                return (
                                    <button
                                        key={p.id}
                                        type="button"
                                        onClick={() => {
                                            setNavDir('fwd')
                                            setLastNavKind('item')
                                            transitionToSelection(p.id)
                                        }}
                                        title={p.name}
                                        className="flex items-end justify-center transition-opacity hover:opacity-100 opacity-90"
                                        style={{
                                            height: `${stripSize.height}px`,
                                            viewTransitionName: `thumb-${p.id}`,
                                        } as React.CSSProperties}
                                    >
                                        {src ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img
                                                src={src}
                                                alt={p.name}
                                                draggable={false}
                                                style={{
                                                    height: '100%',
                                                    width: 'auto',
                                                    objectFit: 'contain',
                                                }}
                                            />
                                        ) : (
                                            <span className="border border-dashed border-neutral-200 text-neutral-300 text-[7pt] px-4 h-full flex items-center">
                                                —
                                            </span>
                                        )}
                                    </button>
                                )
                            })}
                            {filtered.length === 0 && (
                                <span className="col-span-6 py-20 text-[10px] tracking-[0.1em] uppercase opacity-50">
                                    No products match
                                </span>
                            )}
                        </div>
                    </div>
                )}

                {/* Horizontal photo strip (selection mode) — collapsible */}
                {selected && (
                    <div
                        onMouseEnter={() => setStripHovered(true)}
                        onMouseLeave={() => setStripHovered(false)}
                        className="group/strip"
                    >
                        <div
                            ref={stripScrollRef}
                            className="overflow-x-auto pt-16 pb-6 [&::-webkit-scrollbar]:hidden transition-[height] duration-300 ease-out"
                            style={{
                                height: stripHovered
                                    ? stripSize.height + 64 + 24 // content + pt-16 + pb-6
                                    : COLLAPSED_STRIP_HEIGHT + 64,
                            }}
                        >
                            <div
                                className="flex items-end justify-center gap-[16px] min-w-full w-max px-8 transition-[height] duration-300 ease-out"
                                style={{
                                    height: stripHovered
                                        ? `${stripSize.height}px`
                                        : `${COLLAPSED_STRIP_HEIGHT}px`,
                                }}
                            >
                            {filtered.map((p) => {
                                const src = primaryImage(p)
                                const isSelected = p.id === selectedId
                                return (
                                    <button
                                        key={p.id}
                                        ref={isSelected ? selectedThumbRef : undefined}
                                        type="button"
                                        onClick={() => {
                                            const curIdx = selectedId
                                                ? filtered.findIndex(
                                                      (x) => x.id === selectedId,
                                                  )
                                                : -1
                                            const newIdx = filtered.findIndex(
                                                (x) => x.id === p.id,
                                            )
                                            if (curIdx !== -1 && newIdx !== -1) {
                                                setNavDir(newIdx >= curIdx ? 'fwd' : 'back')
                                            }
                                            setLastNavKind('item')
                                            setSelectedId(p.id)
                                        }}
                                        title={p.name}
                                        className="flex-none flex items-end justify-center h-full transition-opacity hover:opacity-100"
                                        style={
                                            {
                                                opacity: isSelected ? 1 : 0.7,
                                                viewTransitionName: `thumb-${p.id}`,
                                            } as React.CSSProperties
                                        }
                                    >
                                        {src ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img
                                                src={src}
                                                alt={p.name}
                                                draggable={false}
                                                style={{
                                                    height: '100%',
                                                    width: 'auto',
                                                    objectFit: 'contain',
                                                }}
                                            />
                                        ) : (
                                            <span className="border border-dashed border-neutral-200 text-neutral-300 text-[7pt] px-4 h-full flex items-center">
                                                —
                                            </span>
                                        )}
                                    </button>
                                )
                            })}
                            {filtered.length === 0 && (
                                <span className="text-[10px] tracking-[0.1em] uppercase opacity-50 self-center">
                                    No products match
                                </span>
                            )}
                        </div>
                        </div>
                    </div>
                )}

                {selected && (
                    <div className="relative w-full px-8 pt-24 min-h-[calc(100vh-200px)]">
                        {/* product image — centered on the page */}
                        <div ref={imageWrapRef} className="mx-auto w-fit">
                            {selectedImg ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                    src={selectedImg}
                                    alt={selected.name}
                                    className="max-h-[200px] w-auto object-contain block"
                                    draggable={false}
                                />
                            ) : (
                                <div className="aspect-square w-[280px] border border-dashed border-neutral-200 flex items-center justify-center text-neutral-300 text-[10pt]">
                                    no image
                                </div>
                            )}
                        </div>

                        {/* tab-swapping card — anchored to the right of the centered image */}
                        <div
                            key={`${selected.id}-${activeTab}`}
                            className={`absolute bottom-[10vh] w-[440px] ${
                                lastNavKind === 'tab'
                                    ? navDir === 'back'
                                        ? 'split-tab-anim-back'
                                        : 'split-tab-anim-fwd'
                                    : ''
                            }`}
                            style={{ left: 'calc(50% + 180px)' }}
                        >
                            {activeTab === 'identity' && (
                                <div
                                    className={`space-y-6 ${
                                        lastNavKind === 'item' ? 'value-stagger' : ''
                                    }`}
                                >
                                    <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                                        <FieldHeader>Item</FieldHeader>
                                        <FieldHeader>Price</FieldHeader>
                                        <ChipValue tone="pink">{deriveCode(selected)}</ChipValue>
                                        <ChipInput
                                            tone="green"
                                            suffix=" usd"
                                            initial={String(Math.round(selected.price))}
                                            onCommit={(v) => {
                                                const n = Number(v.replace(/[^\d.]/g, ''))
                                                if (Number.isFinite(n) && n !== selected.price) {
                                                    saveField({ price: n })
                                                }
                                            }}
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                                        <FieldHeader>Material</FieldHeader>
                                        <FieldHeader>Color</FieldHeader>
                                        <FieldInput
                                            initial={selected.material ?? ''}
                                            placeholder="—"
                                            onCommit={(v) => {
                                                if ((selected.material ?? '') !== v)
                                                    saveField({ material: v })
                                            }}
                                        />
                                        <FieldInput
                                            initial={selected.color ?? ''}
                                            placeholder="—"
                                            onCommit={(v) => {
                                                if ((selected.color ?? '') !== v)
                                                    saveField({ color: v })
                                            }}
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                                        <FieldHeader>Designer</FieldHeader>
                                        <FieldHeader>Designer 2</FieldHeader>
                                        <FieldInput
                                            initial={selected.designerNames[0] ?? ''}
                                            placeholder="—"
                                            onCommit={(v) => {
                                                const cur = [...selected.designerNames]
                                                cur[0] = v
                                                saveField({ designerNames: cur })
                                            }}
                                        />
                                        <FieldInput
                                            initial={selected.designerNames[1] ?? ''}
                                            placeholder="—"
                                            onCommit={(v) => {
                                                const cur = [...selected.designerNames]
                                                cur[1] = v
                                                saveField({ designerNames: cur })
                                            }}
                                        />
                                    </div>
                                    {savePending && (
                                        <p className="text-[8px] tracking-[0.12em] uppercase opacity-40">
                                            Saving…
                                        </p>
                                    )}
                                    <DeleteItemButton
                                        key={`del-${selected.id}`}
                                        productId={selected.id}
                                        productName={selected.name}
                                        onDeleted={() => setSelectedId(null)}
                                    />
                                </div>
                            )}

                            {activeTab !== 'identity' && (
                                <div className="text-[0.8em]">
                                    <ProductForm
                                        product={selected}
                                        orders={detail?.orders ?? []}
                                        inventoryLogs={detail?.inventoryLogs ?? []}
                                        hideTabs
                                        initialTab={activeTab}
                                    />
                                </div>
                            )}
                            {/* anchor for the bottom dashed connector */}
                            <div ref={cardBottomRef} className="h-0 w-full" />
                        </div>
                    </div>
                )}
            </div>

            {/* Bottom pill tab nav with grey bar background */}
            <div
                className={`absolute bottom-0 left-0 right-0 z-[10] bg-[#f1f3fb] py-3 flex justify-center transition-all duration-300 ${
                    selected
                        ? 'translate-y-0 opacity-100 pointer-events-none'
                        : 'translate-y-full opacity-0 pointer-events-none'
                }`}
            >
                <div className="flex items-center gap-[36px] px-12 py-2 pointer-events-auto">
                    {PILL_TABS.map((t) => {
                        const active = activeTab === t.key
                        return (
                            <button
                                key={t.key}
                                ref={(el) => {
                                    tabRefs.current[t.key] = el
                                }}
                                type="button"
                                onClick={() => {
                                    const curIdx = PILL_TABS.findIndex(
                                        (x) => x.key === activeTab,
                                    )
                                    const newIdx = PILL_TABS.findIndex(
                                        (x) => x.key === t.key,
                                    )
                                    setNavDir(newIdx >= curIdx ? 'fwd' : 'back')
                                    setLastNavKind('tab')
                                    setActiveTab(t.key)
                                }}
                                className="font-alte text-[24px] leading-none tracking-[-0.02em] text-[#1a1a1a] transition-opacity"
                                style={{ opacity: active ? 1 : 0.2 }}
                            >
                                {t.label}
                            </button>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}

// Renders a numeric value where each digit fades + slides up when it changes.
// The animation is keyed on `${position}-${digit}`, so React unmounts and
// remounts only the digits that actually changed.
function AnimatedNumber({ value }: { value: number | string }) {
    const text = String(value)
    return (
        <span className="inline-block tabular-nums">
            {text.split('').map((ch, i) => (
                <span
                    key={`${i}-${ch}`}
                    className="animated-digit inline-block"
                >
                    {ch}
                </span>
            ))}
        </span>
    )
}

function FilterChip({
    label,
    dot,
    bordered,
    active,
    onClick,
}: {
    label: React.ReactNode
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

function FieldHeader({ children }: { children: React.ReactNode }) {
    return (
        <p className="font-alte text-[14px] font-bold tracking-tight uppercase text-black leading-none">
            {children}
        </p>
    )
}

function FieldInput({
    initial,
    placeholder,
    onCommit,
}: {
    initial: string
    placeholder?: string
    onCommit: (v: string) => void
}) {
    const [value, setValue] = useState(initial)
    const [focused, setFocused] = useState(false)
    const dirty = value.trim() !== initial.trim()
    const active = focused || dirty
    return (
        <input
            type="text"
            value={value}
            placeholder={placeholder}
            onChange={(e) => setValue(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => {
                setFocused(false)
                onCommit(value.trim())
            }}
            onKeyDown={(e) => {
                if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
            }}
            size={Math.max(value.length || (placeholder?.length ?? 1), 1)}
            style={
                {
                    fieldSizing: 'content',
                    backgroundColor: active ? '#FFE173' : '#ebebeb',
                    transition: 'background-color 160ms ease-out',
                } as React.CSSProperties
            }
            className="rounded-[4px] px-[8px] py-[5px] text-[15px] font-alte text-black inline-block focus:outline-none placeholder:text-neutral-400"
        />
    )
}

function ChipInput({
    initial,
    tone,
    suffix,
    onCommit,
}: {
    initial: string
    tone: 'pink' | 'green'
    suffix?: string
    onCommit: (v: string) => void
}) {
    const baseBg = tone === 'pink' ? '#f1ebeb' : '#e3f0e2'
    const [value, setValue] = useState(initial)
    const [focused, setFocused] = useState(false)
    const dirty = value.trim() !== initial.trim()
    const active = focused || dirty
    return (
        <div className="inline-flex items-baseline gap-2 w-fit text-[26px] font-alte font-bold text-black">
            <input
                type="text"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onFocus={() => setFocused(true)}
                onBlur={() => {
                    setFocused(false)
                    onCommit(value.trim())
                }}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                }}
                size={Math.max(value.length, 1)}
                style={
                    {
                        backgroundColor: active ? '#FFE173' : baseBg,
                        fieldSizing: 'content',
                        transition: 'background-color 160ms ease-out',
                    } as React.CSSProperties
                }
                className="rounded-[11px] px-[8px] py-[2px] focus:outline-none text-[26px] font-alte font-bold text-black inline-block"
            />
            {suffix && (
                <span className="text-[16px] font-alte opacity-60 uppercase tracking-wide">
                    {suffix.trim()}
                </span>
            )}
        </div>
    )
}

function ChipValue({
    children,
    tone,
}: {
    children: React.ReactNode
    tone: 'pink' | 'green'
}) {
    const bg = tone === 'pink' ? '#f1ebeb' : '#e3f0e2'
    return (
        <div
            className="rounded-[11px] px-[8px] py-[2px] text-[26px] font-alte font-bold text-black inline-flex items-center justify-center w-fit"
            style={{ backgroundColor: bg }}
        >
            {children}
        </div>
    )
}

function DeleteItemButton({
    productId,
    productName,
    onDeleted,
}: {
    productId: string
    productName: string
    onDeleted: () => void
}) {
    const [armed, setArmed] = useState(false)
    const [pending, startPending] = useTransition()

    useEffect(() => {
        if (!armed) return
        const t = setTimeout(() => setArmed(false), 3000)
        return () => clearTimeout(t)
    }, [armed])

    function onClick() {
        if (!armed) {
            setArmed(true)
            return
        }
        startPending(() => {
            deleteProduct(productId)
                .then(() => onDeleted())
                .catch(() => setArmed(false))
        })
    }

    return (
        <button
            type="button"
            onClick={onClick}
            disabled={pending}
            title={armed ? `Click again to delete ${productName}` : 'Delete this item'}
            className="rounded-[4px] px-[10px] py-[5px] text-[12px] font-alte font-bold uppercase tracking-[0.06em] inline-block transition-colors disabled:opacity-50"
            style={{
                backgroundColor: armed ? '#DB0B00' : '#fdecec',
                color: armed ? '#ffffff' : '#a02020',
                border: '1px solid #e8a5a5',
            }}
        >
            {pending ? 'Deleting…' : armed ? 'Confirm Delete' : 'Delete Item'}
        </button>
    )
}
