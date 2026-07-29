'use client'

import { useMemo, useState } from 'react'
import { motion, LayoutGroup } from 'framer-motion'
import Link from 'next/link'
import { AdminNav } from './admin-nav'
import { StockCorrectionPanel, type StockUiMode } from './stock-correction-panel'
import { STOCK_THRESHOLDS, STOCK_COLORS } from '@/lib/constants'
import type { Product, ProductSize } from '@prisma/client'

type ProductWithSizes = Product & { sizes: ProductSize[] }
type StockFilter = 'ALL' | 'IN_STOCK' | 'LOW_STOCK' | 'NO_STOCK' | 'UNPUBLISHED'

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
    // Admin/inventory views prefer the background-less "inventory" shot when set;
    // fall back to the cart primary and then any image.
    const inventory = imgs.find((img) => (img as { isInventoryPrimary?: boolean }).isInventoryPrimary)
    const cart = imgs.find((img) => (img as { isCartPrimary?: boolean }).isCartPrimary)
    return inventory?.url ?? cart?.url ?? imgs[0]?.url
}

export function ProductsSidebarView({ products }: { products: ProductWithSizes[] }) {
    const [stockFilter, setStockFilter] = useState<StockFilter>('ALL')

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
        return { inStock, lowStock, noStock, unpub, total: products.length }
    }, [products])

    const filtered = useMemo(() => {
        if (stockFilter === 'ALL') return products
        return products.filter((p) => statusOf(p) === stockFilter)
    }, [products, stockFilter])

    return (
        <div className="absolute inset-0 bg-white overflow-hidden flex flex-col font-inter">
            <AdminNav
                active="inventory"
                variant="top-left"
                topClass="top-[14px]"
                leftClass="left-[18px]"
                mobileLabel="Inventory"
            />

            {/* Mobile layout, rendered at all sizes for now (desktop mode removed). */}
            <MobileInventoryPhotosView
                filteredProducts={filtered}
                stockFilter={stockFilter}
                setStockFilter={setStockFilter}
                counts={counts}
                totalProducts={products.length}
            />
        </div>
    )
}

// ─── Mobile / tablet inventory view (photos) ──────────────────────────────
function MobileInventoryPhotosView({
    filteredProducts,
    stockFilter,
    setStockFilter,
    counts,
    totalProducts,
}: {
    filteredProducts: ProductWithSizes[]
    stockFilter: StockFilter
    setStockFilter: (s: StockFilter) => void
    counts: { inStock: number; lowStock: number; noStock: number; unpub: number; total: number }
    totalProducts: number
}) {
    const [tab, setTab] = useState<'photos' | 'stock'>('photos')

    // Stock tab: tapping a row opens a single-item correction view (shared with
    // the product detail page's inventory tab). Locally-committed sizes are
    // tracked here (keyed by product id) so both the single view and the list
    // totals reflect a correction/add without waiting on a server refetch.
    const [selectedStockId, setSelectedStockId] = useState<string | null>(null)
    const [sizesOverride, setSizesOverride] = useState<Record<string, ProductSize[]>>({})
    // Gates "tap the white area to close" — suppressed while a correction is
    // actually in progress so it can't be dismissed out from under the user.
    const [stockUiMode, setStockUiMode] = useState<StockUiMode>('view')

    const sizesFor = (p: ProductWithSizes) => sizesOverride[p.id] ?? p.sizes

    // The stock filter button that could change filteredProducts is hidden
    // while a single-item view is open, so the selected product can't fall
    // out of the filtered set out from under it — no reconciling effect needed.
    const selectedStockProduct = selectedStockId
        ? filteredProducts.find((p) => p.id === selectedStockId) ?? null
        : null

    // Shared-layout morph: each product image carries the same layoutId in both
    // the Photos grid and the Stock list, so switching tabs animates the image
    // between its two positions/sizes.
    const imgSpring = { type: 'spring', stiffness: 320, damping: 34 } as const

    return (
        <LayoutGroup>
        <div className="absolute inset-0 flex flex-col bg-white z-[10]">
            {/* Top-right Stock / Photos tabs. Eye + "Inventory" label are
                rendered by AdminNav (mobileLabel prop) at top-left. Active
                tab gets the grey pill background (per Figma). Toggles the
                body between the photo grid and the stock list. */}
            <div className="fixed top-[4px] right-4 z-[20] flex items-center gap-2 text-[12px] font-bold">
                <button
                    type="button"
                    onClick={() => setTab('stock')}
                    className={`px-[10px] py-[6px] ${tab === 'stock' ? 'bg-[#d9d9d9]/40' : 'opacity-60 hover:opacity-100'}`}
                >
                    Stock
                </button>
                <button
                    type="button"
                    onClick={() => setTab('photos')}
                    className={`px-[10px] py-[6px] ${tab === 'photos' ? 'bg-[#d9d9d9]/40' : 'opacity-60 hover:opacity-100'}`}
                >
                    Photos
                </button>
            </div>

            {/* Stock list — each row is a 6-col grid: 2 cols for status dot +
                image, 4 cols for the code and the Stock/Available/Committed
                block (Inter). Tapping a row opens the single-item correction
                view below (Figma 1866:318 many-view). */}
            {tab === 'stock' && !selectedStockId && (
                <div className="flex-1 overflow-y-auto pt-28 pb-24 px-4">
                    {filteredProducts.map((p) => {
                        const src = primaryImage(p)
                        const status = statusOf(p)
                        const dotColor =
                            status === 'IN_STOCK' ? STOCK_COLORS.IN_STOCK :
                            status === 'LOW_STOCK' ? STOCK_COLORS.LOW_STOCK :
                            status === 'NO_STOCK' ? STOCK_COLORS.NO_STOCK :
                            '#ffffff'
                        const dotBordered = status === 'UNPUBLISHED'
                        const t = sizesFor(p).reduce(
                            (a, s) => ({
                                stock: a.stock + s.total,
                                avail: a.avail + s.available,
                                committed: a.committed + s.committed,
                            }),
                            { stock: 0, avail: 0, committed: 0 },
                        )
                        return (
                            <button
                                key={p.id}
                                type="button"
                                onClick={() => setSelectedStockId(p.id)}
                                className="grid grid-cols-6 items-center gap-x-2 py-3 w-full text-left"
                            >
                                {/* Indicator + image (2 cols) — image centered & pushed
                                    toward the right; dot pinned to the title/Stock line. */}
                                <div className="col-span-2 relative flex items-center justify-end pr-1">
                                    <motion.span
                                        layoutId={`pdot-${p.id}`}
                                        transition={imgSpring}
                                        className="absolute left-[10px] top-[34px] inline-block w-[6px] h-[6px] rounded-full shrink-0"
                                        style={{
                                            backgroundColor: dotColor,
                                            border: dotBordered ? '1px solid #1a1a1a' : 'none',
                                        }}
                                    />
                                    <div className="w-[96px] h-[112px] flex items-center justify-center">
                                        {src ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <motion.img
                                                layoutId={`pimg-${p.id}`}
                                                transition={imgSpring}
                                                src={src}
                                                alt={p.name}
                                                className="max-h-full max-w-full object-contain"
                                                draggable={false}
                                            />
                                        ) : (
                                            <span className="text-neutral-300 text-[8pt]">—</span>
                                        )}
                                    </div>
                                </div>

                                {/* Code + stock info (4 cols) — group centered against
                                    the image; inside, the code top-aligns with the
                                    Stock row. Block right edge aligns with Photos tab. */}
                                <div className="col-span-4 grid grid-cols-4 items-start gap-x-2">
                                    <motion.span
                                        layoutId={`pname-${p.id}`}
                                        layout="position"
                                        transition={imgSpring}
                                        className="col-span-1 font-alte text-[12px] font-bold leading-[1.6] whitespace-nowrap"
                                    >
                                        {p.name}
                                    </motion.span>
                                    {/* Slides in from the right on tab switch. */}
                                    <motion.div
                                        initial={{ opacity: 0, x: 32 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={imgSpring}
                                        className="col-span-3 font-inter text-[12px] leading-[1.6]"
                                    >
                                        <div className="flex justify-between bg-[#f0f0f0] px-1">
                                            <span className="font-bold">Stock</span>
                                            <span className="font-bold">{t.stock}</span>
                                        </div>
                                        <div className="flex justify-between px-1">
                                            <span className="font-normal">Available</span>
                                            <span className="font-normal">{t.avail}</span>
                                        </div>
                                        <div className="flex justify-between px-1">
                                            <span className="font-extralight italic">Committed</span>
                                            <span className="font-extralight italic">{t.committed}</span>
                                        </div>
                                    </motion.div>
                                </div>
                            </button>
                        )
                    })}
                </div>
            )}

            {/* Single-item view (Figma 1935:248 isCorrecting-adjacent state) —
                same shared image/name/dot layoutIds so it morphs smoothly out
                of the row above. Tapping the white area reverts to the list,
                except the bottom band (Make Correction / Add Stock / the
                confirm modal) which stops that propagation, and any moment a
                correction is actually in progress (stockUiMode !== 'view'). */}
            {tab === 'stock' && selectedStockProduct && (
                <div
                    className="flex-1 overflow-y-auto pt-28 pb-24 px-4"
                    onClick={() => {
                        if (stockUiMode === 'view') setSelectedStockId(null)
                    }}
                >
                    <div className="w-[96px] h-[112px] mx-auto flex items-center justify-center mb-10">
                        {(() => {
                            const src = primaryImage(selectedStockProduct)
                            return src ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <motion.img
                                    layoutId={`pimg-${selectedStockProduct.id}`}
                                    transition={imgSpring}
                                    src={src}
                                    alt={selectedStockProduct.name}
                                    className="max-h-full max-w-full object-contain"
                                    draggable={false}
                                />
                            ) : (
                                <span className="text-neutral-300 text-[8pt]">—</span>
                            )
                        })()}
                    </div>

                    {/* Plain text, not a shared layoutId — only the picture morphs
                        between the list and single-item view; animating the name's
                        position read as visual noise. */}
                    <div className="font-alte text-[12px] font-bold leading-[1.6] mb-3">
                        {selectedStockProduct.name}
                    </div>

                    <StockCorrectionPanel
                        key={selectedStockProduct.id}
                        productId={selectedStockProduct.id}
                        productName={selectedStockProduct.name}
                        sizes={sizesFor(selectedStockProduct)}
                        onSizesChange={(next) =>
                            setSizesOverride((prev) => ({ ...prev, [selectedStockProduct.id]: next }))
                        }
                        onModeChange={setStockUiMode}
                    />
                </div>
            )}

            {/* Product grid — 3 columns, centered labels, generous horizontal padding */}
            {tab === 'photos' && (
            <div className="flex-1 overflow-y-auto pt-32 pb-24 px-6">
                <div className="grid grid-cols-3 gap-x-4 gap-y-10">
                        {filteredProducts.map((p) => {
                            const src = primaryImage(p)
                            const status = statusOf(p)
                            const dotColor =
                                status === 'IN_STOCK' ? STOCK_COLORS.IN_STOCK :
                                status === 'LOW_STOCK' ? STOCK_COLORS.LOW_STOCK :
                                status === 'NO_STOCK' ? STOCK_COLORS.NO_STOCK :
                                '#ffffff'
                            const dotBordered = status === 'UNPUBLISHED'
                            return (
                                <Link
                                    key={p.id}
                                    href={`/admin/products/${p.id}/edit`}
                                    className="flex flex-col items-center"
                                >
                                    <div className="w-full aspect-[3/4] flex items-center justify-center px-3">
                                        {src ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <motion.img
                                                layoutId={`pimg-${p.id}`}
                                                transition={imgSpring}
                                                src={src}
                                                alt={p.name}
                                                className="max-h-full max-w-full object-contain opacity-90"
                                                draggable={false}
                                            />
                                        ) : (
                                            <span className="text-neutral-300 text-[8pt]">—</span>
                                        )}
                                    </div>
                                    <div className="mt-[-12] flex items-center gap-[6px]">
                                        <motion.span
                                            layoutId={`pdot-${p.id}`}
                                            transition={imgSpring}
                                            className="inline-block w-[7px] h-[7px] rounded-full shrink-0"
                                            style={{
                                                backgroundColor: dotColor,
                                                border: dotBordered ? '1px solid #1a1a1a' : 'none',
                                            }}
                                        />
                                        <motion.span
                                            layoutId={`pname-${p.id}`}
                                            layout="position"
                                            transition={imgSpring}
                                            className="text-[12px] font-bold leading-none"
                                        >
                                            {p.name}
                                        </motion.span>
                                    </div>
                                </Link>
                            )
                        })}
                </div>
            </div>
            )}

            {/* Bottom filter — single circle, tap to cycle through statuses.
                Order: All (faded yellow) → Low (yellow) → Out (red) →
                Unpublished (white/black outline) → In stock (green) → All.
                Hidden in the single-item stock view — it would just sit under
                the Make Correction / Add Stock bar and doesn't apply there. */}
            {!selectedStockProduct && (
                <button
                    type="button"
                    onClick={() => {
                        const idx = STOCK_FILTER_CYCLE.indexOf(stockFilter)
                        setStockFilter(STOCK_FILTER_CYCLE[(idx + 1) % STOCK_FILTER_CYCLE.length])
                    }}
                    aria-label={`Stock filter: ${STOCK_FILTER_LABELS[stockFilter]}`}
                    className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[20]"
                >
                    <motion.span
                        animate={{
                            backgroundColor: stockFilterDotColor(stockFilter),
                            borderColor: stockFilter === 'UNPUBLISHED' ? '#1a1a1a' : 'rgba(0,0,0,0)',
                        }}
                        transition={{ type: 'spring', stiffness: 320, damping: 34 }}
                        className="block w-8 h-8 rounded-full border"
                    />
                </button>
            )}
        </div>
        </LayoutGroup>
    )
}

// Tap order for the mobile stock-filter circle.
const STOCK_FILTER_CYCLE: StockFilter[] = ['ALL', 'LOW_STOCK', 'NO_STOCK', 'UNPUBLISHED', 'IN_STOCK']

const STOCK_FILTER_LABELS: Record<StockFilter, string> = {
    ALL: 'All',
    LOW_STOCK: 'Low stock',
    NO_STOCK: 'Out of stock',
    UNPUBLISHED: 'Unpublished',
    IN_STOCK: 'In stock',
}

function stockFilterDotColor(filter: StockFilter): string {
    switch (filter) {
        case 'ALL':
            return `${STOCK_COLORS.LOW_STOCK}59` // faded yellow — no filter
        case 'LOW_STOCK':
            return STOCK_COLORS.LOW_STOCK
        case 'NO_STOCK':
            return STOCK_COLORS.NO_STOCK
        case 'UNPUBLISHED':
            return '#ffffff'
        case 'IN_STOCK':
            return STOCK_COLORS.IN_STOCK
    }
}
