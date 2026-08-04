'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { ProductMobileHeader } from '@/components/admin/product-mobile-header'
import type { Product, ProductSize, Order, OrderItem, InventoryChangeLog } from '@prisma/client'
import { AdminNav } from '@/components/admin/admin-nav'
import { updateProduct } from '@/app/admin/products/actions'
import { StockCorrectionPanel } from '@/components/admin/stock-correction-panel'
import type { Tab } from '@/components/admin/product-form'
import { formatPrice } from '@/lib/utils'

type OrderWithItems = Order & { items: OrderItem[] }

// Spring shared by every transition between the two states so the whole screen
// moves as one system.
const spring = { type: 'spring', stiffness: 300, damping: 30 } as const

type ImageData = {
    url: string
    isMobilePrimary?: boolean
    isDesktopPrimary?: boolean
    isCartPrimary?: boolean
    isGrid1x1Primary?: boolean
    isGrid2x2Primary?: boolean
    isGrid3x3Primary?: boolean
    isInventoryPrimary?: boolean
    showOnPdp?: boolean
}

/** Filled eye used as the image/labels toggle (Figma eye-toggle, 16.8×10.64). */
function ToggleEye({ className = '' }: { className?: string }) {
    return (
        <svg viewBox="0 0 16.8062 10.6398" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
            <path d="M8.31232 10.6298C13.1264 10.6298 16.6233 6.55746 16.6233 5.31742C16.6233 4.07101 13.0902 0 8.31232 0C3.52911 0 0 4.07101 0 5.31742C0 6.55746 3.50498 10.6298 8.31232 10.6298ZM8.31232 8.82475C6.37925 8.82475 4.80496 7.25044 4.80496 5.31742C4.80496 3.38295 6.37925 1.80866 8.31232 1.80866C10.2454 1.80866 11.8196 3.38295 11.8196 5.31742C11.8196 7.25044 10.2454 8.82475 8.31232 8.82475ZM8.31232 6.39965C8.91199 6.39965 9.39591 5.91704 9.39591 5.31742C9.39591 4.71418 8.91199 4.23378 8.31232 4.23378C7.71265 4.23378 7.22872 4.71418 7.22872 5.31742C7.22872 5.91704 7.71265 6.39965 8.31232 6.39965Z" fill="black" fillOpacity="0.85" />
        </svg>
    )
}

// Inputs inherit the value column's text-align so they follow the
// center ↔ right swap between states without per-field props.
const inputBase =
    'bg-transparent outline-none w-full text-[10px] font-bold leading-[1.5] text-black [text-align:inherit] placeholder:text-black placeholder:opacity-20'

/** Single-line borderless editable text, commits on blur. */
function TextInput({
    value,
    onChange,
    onCommit,
    placeholder,
    className = '',
}: {
    value: string
    onChange: (v: string) => void
    onCommit: () => void
    placeholder?: string
    className?: string
}) {
    return (
        <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onCommit}
            placeholder={placeholder}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className={`${inputBase} ${className}`}
        />
    )
}

/** Auto-growing borderless editable textarea, commits on blur. */
function TextArea({
    value,
    onChange,
    onCommit,
    placeholder,
    className = '',
}: {
    value: string
    onChange: (v: string) => void
    onCommit: () => void
    placeholder?: string
    className?: string
}) {
    const ref = useRef<HTMLTextAreaElement>(null)
    useEffect(() => {
        const el = ref.current
        if (el) {
            el.style.height = 'auto'
            el.style.height = `${el.scrollHeight}px`
        }
    }, [value])
    return (
        <textarea
                ref={ref}
            rows={1}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onCommit}
            placeholder={placeholder}
            className={`${inputBase} resize-none overflow-hidden ${className}`}
        />
    )
}

/** One row of the listing.
 *  - Collapsed (showLabels=false): value column centered, label hidden.
 *  - Labels (showLabels=true): label pinned left, value pinned right.
 *  The label is always mounted but positioned absolutely (out of flow) and
 *  only fades — so every row's value column shares identical layout geometry
 *  and springs in unison via framer `layout` (no reflow delay on switch). */
function SplitRow({
    label,
    showLabels,
    children,
}: {
    label?: string
    showLabels: boolean
    children: React.ReactNode
}) {
    return (
        <div
            className="relative flex w-full"
            style={{ justifyContent: showLabels ? 'flex-end' : 'center' }}
        >
            {label && (
                <motion.div
                    animate={{ opacity: showLabels ? 1 : 0 }}
                    transition={spring}
                    className="absolute left-0 top-0 text-[10px] leading-[1.5] text-black pointer-events-none"
                >
                    {label}
                </motion.div>
            )}
            <motion.div
                layout="position"
                transition={spring}
                className={`w-[60%] text-[10px] font-bold leading-[1.5] text-black ${
                    showLabels ? 'text-right' : 'text-center'
                }`}
            >
                {children}
            </motion.div>
        </div>
    )
}

export function ProductDetailMobile({
    product,
    initialTab,
    orders = [],
    inventoryLogs = [],
}: {
    product: Product & { sizes: ProductSize[] }
    initialTab?: Tab
    orders?: OrderWithItems[]
    inventoryLogs?: InventoryChangeLog[]
}) {
    const isInventory = initialTab === 'sizing'
    // false → image visible / labels hidden (Figma 1826:537)
    // true  → labels visible / image hidden  (Figma 1826:572)
    const [showLabels, setShowLabels] = useState(false)
    // Page 1 = core listing fields; Page 2 = the rest (slug, description, …).
    const [page, setPage] = useState<1 | 2>(1)
    // "More" panel — stock history (sales + corrections) and sell-through stats.
    const [moreOpen, setMoreOpen] = useState(false)

    // Editable form state, seeded from the product.
    const [name, setName] = useState(product.name)
    const [designerNames, setDesignerNames] = useState<string[]>(product.designerNames)
    const [newDesigner, setNewDesigner] = useState('')
    const [attribute1, setAttribute1] = useState(product.attribute1 ?? '')
    const [attribute2, setAttribute2] = useState(product.attribute2 ?? '')
    const [material, setMaterial] = useState(product.material ?? '')
    const [color, setColor] = useState(product.color ?? '')
    const [colorHex, setColorHex] = useState(product.colorHex ?? '')
    const [price, setPrice] = useState(String(product.price))
    const [description, setDescription] = useState(product.description ?? '')
    const [keywordsText, setKeywordsText] = useState(product.keywords.join(', '))
    const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle')

    const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

    // Inventory tab — "Make Correction" / "Add Stock" (Figma 1928:3242 default
    // state / 1935:248 isCorrecting state) lives in StockCorrectionPanel, shared
    // with the products-new mobile stock list's single-item view.
    const [sizes, setSizes] = useState(product.sizes)

    // Statistics — total units sold and revenue across this product's orders.
    const totalSold = orders.reduce((sum, o) => sum + o.items.reduce((s, i) => s + i.quantity, 0), 0)
    const totalRevenue = orders
        .filter((o) => o.status !== 'CANCELLED')
        .reduce((sum, o) => sum + o.items.reduce((s, i) => s + i.price * i.quantity, 0), 0)

    // Stock history — sales and manual stock edits merged into one feed, newest first.
    type HistoryEntry = { id: string; date: Date; label: string; detail: string; delta: number }
    const saleEntries: HistoryEntry[] = orders
        .filter((o) => o.status !== 'CANCELLED')
        .map((o) => ({
            id: `order-${o.id}`,
            date: new Date(o.createdAt),
            label: `Order O-${o.orderNumber.slice(-3)}`,
            detail: 'Sale',
            delta: -o.items.reduce((s, i) => s + i.quantity, 0),
        }))
    const editEntries: HistoryEntry[] = inventoryLogs.map((l) => ({
        id: `log-${l.id}`,
        date: new Date(l.createdAt),
        label: l.sizeLabel,
        detail: l.adminName || l.adminEmail || 'Correction',
        delta: l.delta,
    }))
    const historyEntries = [...saleEntries, ...editEntries].sort(
        (a, b) => b.date.getTime() - a.date.getTime(),
    )

    const images = (Array.isArray(product.images) ? product.images : []) as unknown as ImageData[]
    const displayImage =
        images.find((i) => i?.isInventoryPrimary)?.url ||
        images.find((i) => i?.isDesktopPrimary)?.url ||
        images.find((i) => i?.isMobilePrimary)?.url ||
        images[0]?.url ||
        null

    // Persist the whole listing. updateProduct ignores sizes, and we pass the
    // product's existing images/published through unchanged (edited elsewhere).
    async function commit(nextDesigners = designerNames) {
        setStatus('saving')
        try {
            await updateProduct(product.id, {
                name: name.trim() || product.name,
                description: description.trim(),
                keywords: keywordsText.split(',').map((k) => k.trim()).filter(Boolean),
                designerNames: nextDesigners.map((d) => d.trim()).filter(Boolean),
                material: material.trim(),
                color: color.trim(),
                colorHex: colorHex.trim(),
                attribute1: attribute1.trim(),
                attribute2: attribute2.trim(),
                price: parseFloat(price) || 0,
                published: product.published,
                images: images.map((im) => ({
                    url: im.url,
                    isMobilePrimary: !!im.isMobilePrimary,
                    isDesktopPrimary: !!im.isDesktopPrimary,
                    isCartPrimary: !!im.isCartPrimary,
                    isGrid1x1Primary: !!im.isGrid1x1Primary,
                    isGrid2x2Primary: !!im.isGrid2x2Primary,
                    isGrid3x3Primary: !!im.isGrid3x3Primary,
                    isInventoryPrimary: !!im.isInventoryPrimary,
                    showOnPdp: im.showOnPdp !== false,
                })),
                sizes: [],
            })
            setStatus('saved')
            if (savedTimer.current) clearTimeout(savedTimer.current)
            savedTimer.current = setTimeout(() => setStatus('idle'), 1500)
        } catch {
            setStatus('idle')
        }
    }

    function commitNewDesigner() {
        const v = newDesigner.trim()
        if (!v) return
        const next = [...designerNames, v]
        setDesignerNames(next)
        setNewDesigner('')
        commit(next)
    }

    function updateDesigner(i: number, v: string) {
        setDesignerNames((prev) => prev.map((d, idx) => (idx === i ? v : d)))
    }

    // Rows for each page. Same layout, different field set.
    const page1Rows: { label: string; content: React.ReactNode }[] = [
        {
            label: 'Designer(s):',
            content: (
                <>
                    {designerNames.map((n, i) => (
                        <TextInput
                            key={i}
                            value={n}
                            onChange={(v) => updateDesigner(i, v)}
                            onCommit={() => commit()}
                        />
                    ))}
                    <TextInput
                        value={newDesigner}
                        onChange={setNewDesigner}
                        onCommit={commitNewDesigner}
                        placeholder="Add designer"
                    />
                </>
            ),
        },
        {
            label: 'Attribute 1:',
            content: (
                <>
                    <TextInput value={attribute1} onChange={setAttribute1} onCommit={() => commit()} placeholder="Attribute 1" />
                    <TextInput value={attribute2} onChange={setAttribute2} onCommit={() => commit()} placeholder="Add Attribute" />
                </>
            ),
        },
        {
            label: 'Material:',
            content: <TextInput value={material} onChange={setMaterial} onCommit={() => commit()} placeholder="Add material" />,
        },
        {
            label: 'Color name:',
            content: (
                <>
                    <TextInput value={color} onChange={setColor} onCommit={() => commit()} placeholder="Add color name" />
                    <TextInput value={colorHex} onChange={setColorHex} onCommit={() => commit()} placeholder="Add color hex" />
                </>
            ),
        },
        {
            label: 'Price (usd):',
            content: (
                <div className={`flex w-full items-baseline gap-0.5 ${showLabels ? 'justify-end' : 'justify-center'}`}>
                    <span className="shrink-0">$</span>
                    <input
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        onBlur={() => commit()}
                        inputMode="decimal"
                        style={{ width: `calc(${(price.length || 1)}ch + 2px)` }}
                        className={`${inputBase} !text-left shrink-0`}
                    />
                </div>
            ),
        },
    ]

    const page2Rows: { label: string; content: React.ReactNode }[] = [
        {
            label: 'Description:',
            content: (
                <TextArea
                    value={description}
                    onChange={setDescription}
                    onCommit={() => commit()}
                    placeholder="Add description"
                    className={showLabels ? 'font-bold' : 'font-normal'}
                />
            ),
        },
        {
            label: 'Keywords:',
            content: <TextInput value={keywordsText} onChange={setKeywordsText} onCommit={() => commit()} placeholder="Add keywords" />,
        },
        {
            label: 'Sizing:',
            content: (
                <Link href={`/admin/products/${product.id}/sizing`} className="underline underline-offset-[3px]">
                    Manage Sizing
                </Link>
            ),
        },
        {
            label: 'History:',
            content: (
                <button type="button" onClick={() => setMoreOpen(true)} className="underline underline-offset-[3px]">
                    More
                </button>
            ),
        },
    ]

    const rows = page === 1 ? page1Rows : page2Rows

    return (
        <div className="relative min-h-[100dvh] bg-white text-black">
            {/* Real admin nav (mobile eye-hub) in the top-left */}
            <AdminNav active="inventory" mobileLabel="Inventory" mobileBackHref="/admin/products-new" />

            {/* Shared fixed header: save status, name badge, and tab bar.
                Rendered at all sizes for now — desktop editor removed. */}
            <ProductMobileHeader
                productId={product.id}
                productSlug={product.slug}
                name={name}
                active={isInventory ? 'inventory' : 'listing'}
                status={status}
                hiddenClass=""
            />

            {/* Inventory tab — per-size Stock / Available / Committed. Stock becomes
                an editable, pulsing field while correcting or adding stock. */}
            {isInventory && (
                <div className="px-4 pt-[120px] pb-16">
                    <StockCorrectionPanel
                        productId={product.id}
                        productName={product.name}
                        sizes={sizes}
                        onSizesChange={setSizes}
                    />
                </div>
            )}

            {/* Body (Listing) */}
            {!isInventory && (
            <>
            <div className="relative px-4 pt-[120px] pb-[360px]">
                {/* Code / name value row — the eye toggle stays pinned left; the code
                    value follows the shared center ↔ right motion. */}
                <div className="relative">
                    <button
                        type="button"
                        onClick={() => setShowLabels((v) => !v)}
                        aria-label={showLabels ? 'Show image' : 'Show field labels'}
                        aria-pressed={showLabels}
                        className="absolute left-0 top-1/2 -translate-y-1/2 z-20 p-1 -m-1"
                    >
                        <ToggleEye className="w-[17px] h-[11px]" />
                    </button>
                    <SplitRow showLabels={showLabels}>
                        <TextInput value={name} onChange={setName} onCommit={() => commit()} placeholder="Item code" className="!leading-none" />
                    </SplitRow>
                </div>

                {/* Per-page fields */}
                <div className="mt-9">
                    <AnimatePresence mode="wait" initial={false}>
                        <motion.div
                            key={page}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.22, ease: 'easeInOut' }}
                        >
                            {rows.map((row, i) => (
                                <div key={row.label} className={i === 0 ? '' : 'mt-7'}>
                                    <SplitRow label={row.label} showLabels={showLabels}>
                                        {row.content}
                                    </SplitRow>
                                </div>
                            ))}
                        </motion.div>
                    </AnimatePresence>
                </div>
            </div>

            {/* Product image — centered & lower when collapsed. In the labels
                state it's fixed to the bottom-right of the screen (ignores
                scroll) and shrinks to ~70% of its collapsed-adjacent size. */}
            {displayImage && (
                <motion.div
                    initial={false}
                    animate={
                        showLabels
                            ? { width: 150, bottom: -10, left: 'calc(100vw - 140px)' }
                            : { width: 150, bottom: 10, left: 'calc(50vw - 75px)' }
                    }
                    transition={spring}
                    className="fixed z-0 pointer-events-none"
                >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={displayImage} alt={name} className="w-full aspect-[251/317] object-cover" />
                </motion.div>
            )}

            {/* Page toggle — centered when collapsed, bottom-left in the labels state. */}
            <motion.button
                type="button"
                onClick={() => setPage((p) => (p === 1 ? 2 : 1))}
                    initial={false}
                animate={{ left: showLabels ? '16px' : '50%', x: showLabels ? '0%' : '-50%' }}
                transition={spring}
                className="fixed bottom-4 z-10 text-[10px] font-bold leading-none hover:opacity-70"
            >
                Page {page}/2
            </motion.button>
            </>
            )}

            {/* More panel — statistics + stock history, styled to match the
                Inventory tab's StockCorrectionPanel rows (font-alte labels,
                font-inter values, bg-[#f0f0f0] slabs). */}
            {moreOpen && (
                <div className="fixed inset-0 z-40 bg-white overflow-y-auto px-4 pt-[120px] pb-16">
                    <button
                        type="button"
                        onClick={() => setMoreOpen(false)}
                        aria-label="Close"
                        className="fixed top-[100px] right-4 z-50 text-[12px] font-bold hover:opacity-60"
                    >
                        Close
                    </button>

                    {/* Statistics — two columns, mirrors the Stock/Available row style. */}
                    <div className="flex items-start justify-between gap-3">
                        <span className="font-alte text-[12px] font-bold leading-[1.6] whitespace-nowrap">
                            Statistics
                        </span>
                        <div className="w-[60%] font-inter text-[12px] leading-[1.6]">
                            <div className="flex justify-between px-1 bg-[#f0f0f0]">
                                <span className="font-bold">Total Sold</span>
                                <span className="font-bold">{totalSold}</span>
                            </div>
                            <div className="flex justify-between px-1">
                                <span className="font-normal">Total Revenue</span>
                                <span className="font-normal">{formatPrice(totalRevenue)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Stock history — sales and manual corrections, newest first. */}
                    <div className="mt-9">
                        <span className="font-alte text-[12px] font-bold leading-[1.6]">Stock History</span>
                        <div className="mt-3 flex flex-col gap-3">
                            {historyEntries.length === 0 ? (
                                <p className="text-[12px] opacity-40">No history yet</p>
                            ) : (
                                historyEntries.map((entry) => (
                                    <div key={entry.id} className="flex items-center justify-between gap-3 px-1 font-inter text-[12px] leading-[1.6]">
                                        <div className="flex flex-col min-w-0">
                                            <span className="font-bold truncate">{entry.label}</span>
                                            <span className="opacity-40 truncate">{entry.detail}</span>
                                        </div>
                                        <div className="flex flex-col items-end shrink-0">
                                            <span className={`font-bold ${entry.delta > 0 ? 'text-[#1a7a1a]' : entry.delta < 0 ? 'text-[#a02020]' : ''}`}>
                                                {entry.delta > 0 ? '+' : ''}
                                                {entry.delta}
                                            </span>
                                            <span className="opacity-40">
                                                {entry.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                            </span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
