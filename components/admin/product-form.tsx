'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createProduct, updateProduct } from '@/app/admin/products/actions'
import { ImageManager, type ImageData } from '@/components/admin/image-manager'
import { formatDesignerNames } from '@/lib/designers'
import { formatPrice } from '@/lib/utils'
import type { Product, ProductSize, Order, OrderItem } from '@prisma/client'

type ProductWithSizes = Product & {
    sizes: ProductSize[]
    keywords?: string[]
}

type OrderWithItems = Order & {
    items: OrderItem[]
}

const AVAILABLE_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL']
const MAX_DESIGNERS = 8

type Tab = 'identity' | 'look' | 'sizing' | 'listing' | 'sales'

const TABS_CREATE: { key: Tab; label: string }[] = [
    { key: 'identity', label: 'Identity' },
    { key: 'look', label: 'Look' },
    { key: 'sizing', label: 'Inventory' },
    { key: 'listing', label: 'Listing' },
]

const TABS_EDIT: { key: Tab; label: string }[] = [
    ...TABS_CREATE,
    { key: 'sales', label: 'Sales' },
]

const inputClass =
    'w-full px-4 py-3 bg-neutral-100 rounded-lg text-sm focus:outline-none focus:bg-neutral-200 transition-colors placeholder:text-neutral-400'

const labelClass = 'block text-sm font-bold mb-2'

export function ProductForm({
    product,
    orders,
}: {
    product?: ProductWithSizes
    orders?: OrderWithItems[]
}) {
    const router = useRouter()
    const TABS = product ? TABS_EDIT : TABS_CREATE
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [activeTab, setActiveTab] = useState<Tab>('identity')
    const [warnings, setWarnings] = useState<Array<{ tab: Tab; severity: 'error' | 'warning'; message: string }>>([])

    const [name, setName] = useState(product?.name || '')
    const [slug, setSlug] = useState(product?.slug || '')
    const [description, setDescription] = useState(product?.description || '')
    const [keywordsInput, setKeywordsInput] = useState((product?.keywords || []).join(', '))
    const [designerNames, setDesignerNames] = useState<string[]>(
        product?.designerNames?.length ? product.designerNames : ['']
    )
    const [price, setPrice] = useState<string>(product?.price ? String(product.price) : '')
    const [published, setPublished] = useState(product?.published || false)

    const [images, setImages] = useState<ImageData[]>(() => {
        if (!product?.images) return []
        const rawImages = product.images as unknown
        if (Array.isArray(rawImages) && typeof rawImages[0] === 'object' && rawImages[0] !== null && 'url' in rawImages[0]) {
            return rawImages.map((img, index: number) => {
                const image = img as { url?: string; isMobilePrimary?: boolean; isDesktopPrimary?: boolean; isCartPrimary?: boolean }
                return {
                    url: image.url || '',
                    isMobilePrimary: image.isMobilePrimary ?? (index === 0),
                    isDesktopPrimary: image.isDesktopPrimary ?? (index === 0),
                    isCartPrimary: image.isCartPrimary ?? (index === 0),
                }
            })
        }
        if (Array.isArray(rawImages)) {
            return rawImages.map((url: string, index: number) => ({
                url,
                isMobilePrimary: index === 0,
                isDesktopPrimary: index === 0,
                isCartPrimary: index === 0,
            }))
        }
        return []
    })

    const [material, setMaterial] = useState(product?.material || '')
    const [color, setColor] = useState(product?.color || '')
    const [colorHex, setColorHex] = useState(product?.colorHex || '')

    const [sizes, setSizes] = useState<{ size: string; available: number }[]>(
        product?.sizes.length
            ? product.sizes.map((s) => ({ size: s.size, available: s.available }))
            : [{ size: 'M', available: 0 }]
    )

    function updateSize(index: number, field: 'size' | 'available', value: string | number) {
        const newSizes = [...sizes]
        newSizes[index] = { ...newSizes[index], [field]: value }
        setSizes(newSizes)
    }

    function addSize() {
        const usedSizes = sizes.map((s) => s.size)
        const availableSize = AVAILABLE_SIZES.find((s) => !usedSizes.includes(s))
        if (availableSize) setSizes([...sizes, { size: availableSize, available: 0 }])
    }

    function removeSize(index: number) {
        setSizes(sizes.filter((_, i) => i !== index))
    }

    function updateDesigner(index: number, value: string) {
        const next = [...designerNames]
        next[index] = value
        setDesignerNames(next)
    }

    function addDesigner() {
        if (designerNames.length >= MAX_DESIGNERS) return
        setDesignerNames([...designerNames, ''])
    }

    function removeDesigner(index: number) {
        if (designerNames.length === 1) { setDesignerNames(['']); return }
        setDesignerNames(designerNames.filter((_, i) => i !== index))
    }

    type Issue = { tab: Tab; severity: 'error' | 'warning'; message: string }

    function validateAll(): Issue[] {
        const issues: Issue[] = []

        // Required to continue (errors)
        if (!name.trim()) {
            issues.push({ tab: 'identity', severity: 'error', message: 'Item Code is required' })
        }
        if (!price.trim() || Number(price) <= 0) {
            issues.push({ tab: 'listing', severity: 'error', message: 'Price is required' })
        }

        // Required for publishing
        const noImages = images.length === 0
        const noMaterial = !material.trim()
        if (published) {
            if (noImages) {
                issues.push({ tab: 'identity', severity: 'error', message: 'Product images are required to publish' })
            }
            if (noMaterial) {
                issues.push({ tab: 'look', severity: 'error', message: 'Material is required to publish' })
            }
        } else {
            if (noImages) {
                issues.push({ tab: 'identity', severity: 'warning', message: 'No product images uploaded (required to publish)' })
            }
            if (noMaterial) {
                issues.push({ tab: 'look', severity: 'warning', message: 'Material is empty (required to publish)' })
            }
        }

        // Soft warnings
        if (!color.trim()) {
            issues.push({ tab: 'look', severity: 'warning', message: 'Color name is empty' })
        }
        if (sizes.length === 0 || sizes.every((s) => s.available <= 0)) {
            issues.push({ tab: 'sizing', severity: 'warning', message: 'No size has stock' })
        }

        return issues
    }

    function validateTab(tab: Tab): Issue[] {
        return validateAll().filter((i) => i.tab === tab)
    }

    const tabIndex = TABS.findIndex((t) => t.key === activeTab)
    const isLastTab = tabIndex === TABS.length - 1
    const showPreview = tabIndex > 0

    const errors = warnings.filter((w) => w.severity === 'error')

    function jumpToTab(key: Tab) {
        const targetIndex = TABS.findIndex((t) => t.key === key)
        // Jumping forward via tab label must respect the same error gate as
        // clicking Next — collect errors on every tab up to (but not including)
        // the target. Jumping backward is always allowed.
        if (targetIndex > tabIndex) {
            const blockingErrors: Issue[] = []
            for (let i = tabIndex; i < targetIndex; i++) {
                blockingErrors.push(
                    ...validateTab(TABS[i].key).filter((x) => x.severity === 'error'),
                )
            }
            if (blockingErrors.length > 0) {
                setWarnings(blockingErrors)
                return
            }
        }
        setWarnings([])
        setActiveTab(key)
    }

    function goBack() {
        setWarnings([])
        const prev = TABS[tabIndex - 1]
        if (prev) setActiveTab(prev.key)
    }

    function goNext() {
        const found = validateTab(activeTab)
        const tabErrors = found.filter((i) => i.severity === 'error')
        // Errors always block — they never bypass on second click.
        if (tabErrors.length > 0) {
            setWarnings(found)
            return
        }
        // Warning-only: first click surfaces them; second click advances.
        if (found.length > 0 && warnings.length === 0) {
            setWarnings(found)
            return
        }
        setWarnings([])
        const next = TABS[tabIndex + 1]
        if (next) setActiveTab(next.key)
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        const allIssues = validateAll()
        const allErrors = allIssues.filter((i) => i.severity === 'error')
        // Errors block submission outright.
        if (allErrors.length > 0) {
            setWarnings(allIssues)
            return
        }
        // Warning-only: first click surfaces them; second click submits.
        if (allIssues.length > 0 && warnings.length === 0) {
            setWarnings(allIssues)
            return
        }
        setIsSubmitting(true)
        const data = {
            name,
            slug: slug || undefined,
            description: description || undefined,
            keywords: keywordsInput.split(/[,\n]/).map((k: string) => k.trim()).filter(Boolean),
            designerNames: designerNames.map((n) => n.trim()).filter(Boolean).slice(0, MAX_DESIGNERS),
            material: material || undefined,
            color: color || undefined,
            colorHex: colorHex || undefined,
            price: Number(price),
            published,
            images,
            sizes: sizes.filter((s) => s.size),
        }
        if (product) {
            await updateProduct(product.id, data)
        } else {
            await createProduct(data)
        }
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-6">

            {showPreview && (
                <GridItemPreview
                    name={name}
                    material={material}
                    color={color}
                    designerNames={designerNames}
                    images={images}
                />
            )}

            {/* ── Tab bar ── */}
            <div className="flex items-baseline gap-4 flex-wrap border-b border-neutral-100 pb-3">
                {TABS.map((t) => (
                    <button
                        key={t.key}
                        type="button"
                        onClick={() => jumpToTab(t.key)}
                        className="font-alte text-[26px] leading-none tracking-[-0.02em] text-black transition-opacity active:opacity-60"
                        style={{ opacity: activeTab === t.key ? 1 : 0.18 }}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {/* ── Identity ── */}
            {activeTab === 'identity' && (
                <div className="space-y-5">
                    <div>
                        <p className="text-sm font-bold mb-3">Product Images:</p>
                        <ImageManager images={images} onChange={setImages} />
                    </div>

                    <div className="pt-3 border-t border-neutral-100">
                        <label htmlFor="name" className={labelClass}>Item Code:</label>
                        <input
                            id="name"
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className={inputClass}
                        />
                    </div>

                    <div className="pt-3 border-t border-neutral-100">
                        <div className="flex items-center justify-between mb-3">
                            <p className="text-sm font-bold">Designers:</p>
                            <button
                                type="button"
                                onClick={addDesigner}
                                disabled={designerNames.length >= MAX_DESIGNERS}
                                className="text-xs underline hover:no-underline disabled:opacity-40"
                            >
                                Add Designer
                            </button>
                        </div>
                        <div className="space-y-2">
                            {designerNames.map((designer, index) => (
                                <div key={index} className="flex items-center gap-3">
                                    <input
                                        type="text"
                                        value={designer}
                                        onChange={(e) => updateDesigner(index, e.target.value)}
                                        placeholder={`Designer ${index + 1}`}
                                        className={inputClass}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => removeDesigner(index)}
                                        disabled={designerNames.length === 1}
                                        className="text-xs text-neutral-400 hover:text-red-500 underline hover:no-underline disabled:opacity-30 whitespace-nowrap"
                                    >
                                        Remove
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* ── Look ── */}
            {activeTab === 'look' && (
                <div className="space-y-5">
                    <div>
                        <label htmlFor="material" className={labelClass}>Material:</label>
                        <input
                            id="material"
                            type="text"
                            value={material}
                            onChange={(e) => setMaterial(e.target.value)}
                            placeholder="e.g. Cotton, Wool, Polyester"
                            className={inputClass}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="color" className={labelClass}>Color Name:</label>
                            <input
                                id="color"
                                type="text"
                                value={color}
                                onChange={(e) => setColor(e.target.value)}
                                placeholder="e.g. Black, Navy"
                                className={inputClass}
                            />
                        </div>
                        <div>
                            <label htmlFor="colorHex" className={labelClass}>Color Hex:</label>
                            <input
                                id="colorHex"
                                type="text"
                                value={colorHex}
                                onChange={(e) => setColorHex(e.target.value)}
                                placeholder="#000000"
                                className={inputClass}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* ── Sizing ── */}
            {activeTab === 'sizing' && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <p className="text-sm font-bold">Inventory by Size:</p>
                        <button
                            type="button"
                            onClick={addSize}
                            disabled={sizes.length >= AVAILABLE_SIZES.length}
                            className="text-xs underline hover:no-underline disabled:opacity-40"
                        >
                            Add Size
                        </button>
                    </div>
                    <div className="space-y-3">
                        {sizes.map((sizeItem, index) => (
                            <div key={index} className="flex items-center gap-3">
                                <select
                                    value={sizeItem.size}
                                    onChange={(e) => updateSize(index, 'size', e.target.value)}
                                    className="px-4 py-3 bg-neutral-100 rounded-lg text-sm focus:outline-none focus:bg-neutral-200 transition-colors"
                                >
                                    {AVAILABLE_SIZES.map((size) => (
                                        <option key={size} value={size}>{size}</option>
                                    ))}
                                </select>
                                <input
                                    type="number"
                                    min="0"
                                    value={sizeItem.available}
                                    onChange={(e) => updateSize(index, 'available', Number(e.target.value))}
                                    className={`${inputClass} flex-1`}
                                    placeholder="Available"
                                />
                                <button
                                    type="button"
                                    onClick={() => removeSize(index)}
                                    disabled={sizes.length === 1}
                                    className="text-xs text-neutral-400 hover:text-red-500 underline hover:no-underline disabled:opacity-30 whitespace-nowrap"
                                >
                                    Remove
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Listing ── */}
            {activeTab === 'listing' && (
                <div className="space-y-5">
                    <div>
                        <label htmlFor="slug" className={labelClass}>Slug:</label>
                        <input
                            id="slug"
                            type="text"
                            value={slug}
                            onChange={(e) => setSlug(e.target.value)}
                            placeholder="auto-generated-from-item-code"
                            className={inputClass}
                        />
                        <p className="text-xs text-neutral-500 mt-1.5">Leave blank to auto-generate from item code</p>
                    </div>

                    <div>
                        <label htmlFor="description" className={labelClass}>Description:</label>
                        <textarea
                            id="description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={4}
                            className={`${inputClass} resize-none`}
                        />
                    </div>

                    <div>
                        <label htmlFor="price" className={labelClass}>Price (USD):</label>
                        <input
                            id="price"
                            type="number"
                            step="0.01"
                            min="0"
                            value={price}
                            onChange={(e) => setPrice(e.target.value)}
                            placeholder="0.00"
                            className={inputClass}
                        />
                    </div>

                    <div>
                        <label htmlFor="keywords" className={labelClass}>Keywords:</label>
                        <textarea
                            id="keywords"
                            value={keywordsInput}
                            onChange={(e) => setKeywordsInput(e.target.value)}
                            rows={2}
                            placeholder="oversized, winter, outerwear, cotton"
                            className={`${inputClass} resize-none`}
                        />
                        <p className="text-xs text-neutral-500 mt-1.5">Comma-separated — used in store and admin search</p>
                    </div>

                    <div className="pt-3 border-t border-neutral-100">
                        <label className="flex items-center gap-2.5 cursor-pointer select-none">
                            <input
                                type="checkbox"
                                checked={published}
                                onChange={(e) => setPublished(e.target.checked)}
                                className="w-4 h-4 accent-black"
                            />
                            <span className="text-sm font-bold">Published</span>
                            <span className="text-xs text-neutral-500">(visible on store)</span>
                        </label>
                    </div>
                </div>
            )}

            {/* ── Sales (edit-only) ── */}
            {activeTab === 'sales' && product && (
                <SalesPanel orders={orders ?? []} />
            )}

            {/* ── Issues panel ── */}
            {warnings.length > 0 && (() => {
                const hasErrors = errors.length > 0
                return (
                    <div
                        className={`px-4 py-3 text-xs text-neutral-800 border ${
                            hasErrors
                                ? 'bg-[#fdecec] border-[#e8a5a5]'
                                : 'bg-[#fff8e1] border-[#f0d97a]'
                        }`}
                    >
                        <p
                            className={`font-bold uppercase tracking-[0.08em] text-[10px] mb-1.5 ${
                                hasErrors ? 'text-[#8a0000]' : 'text-[#8a6d00]'
                            }`}
                        >
                            {hasErrors ? 'Required fields missing' : 'Heads up — optional fields'}
                        </p>
                        <ul className="list-disc pl-4 space-y-0.5">
                            {warnings.map((w, i) => (
                                <li key={i} className={w.severity === 'error' ? 'text-[#8a0000] font-medium' : ''}>
                                    {w.message}
                                </li>
                            ))}
                        </ul>
                        <p className="mt-2 text-[11px] text-neutral-500">
                            {hasErrors
                                ? 'Fix the items in red to continue.'
                                : isLastTab
                                  ? `Click ${product ? 'Update' : 'Create'} again to save anyway, or fix the items above.`
                                  : 'Click Next again to continue anyway, or fix the items above.'}
                        </p>
                    </div>
                )
            })()}

            {/* ── Wizard footer ── */}
            <div className="pt-4 border-t border-neutral-100 flex items-center justify-between gap-6">
                <button
                    type="button"
                    onClick={() => router.back()}
                    className="text-sm text-neutral-400 hover:text-black underline hover:no-underline"
                >
                    Cancel
                </button>

                <div className="flex items-center gap-6">
                    {tabIndex > 0 && (
                        <button
                            type="button"
                            onClick={goBack}
                            className="text-sm text-neutral-400 hover:text-black underline hover:no-underline"
                        >
                            Back
                        </button>
                    )}
                    {isLastTab ? (
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="text-sm font-bold underline hover:no-underline disabled:opacity-40"
                        >
                            {isSubmitting ? 'Saving...' : product ? 'Update Product' : 'Create Product'}
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={goNext}
                            className="text-sm font-bold underline hover:no-underline"
                        >
                            Next
                        </button>
                    )}
                </div>
            </div>

        </form>
    )
}

// ── Grid Item Preview ────────────────────────────────────────────────────────
// Mirrors the desktop layout of components/store/product-card.tsx at a fixed
// width, pinned to the left edge of the screen. Updates live as the form fills.

function GridItemPreview({
    name,
    material,
    color,
    designerNames,
    images,
}: {
    name: string
    material: string
    color: string
    designerNames: string[]
    images: ImageData[]
}) {
    const primary =
        images.find((i) => i.isDesktopPrimary)?.url ??
        images.find((i) => i.isMobilePrimary)?.url ??
        images[0]?.url ??
        null
    const designerLabel = formatDesignerNames(designerNames)
    const keepDesignerSingleLine = designerNames.filter(Boolean).length < 3

    return (
        <div className="hidden lg:block fixed left-[8px] top-[120px] z-[55] w-[220px] pointer-events-none">
            <p className="font-reformat text-[8px] tracking-[0.12em] uppercase text-neutral-500 mb-2 pl-1">
                Grid Preview
            </p>
            <div className="relative bg-white border border-black/10">
                <div className="relative" style={{ aspectRatio: '3587 / 4400' }}>
                    {primary ? (
                        <Image
                            src={primary}
                            alt=""
                            fill
                            className="object-cover"
                            sizes="220px"
                        />
                    ) : (
                        <div className="absolute inset-0 bg-neutral-50 flex items-center justify-center text-[8pt] text-neutral-300">
                            No Image
                        </div>
                    )}
                </div>
                <div className="bg-gray-100/20 pt-6 pb-5 opacity-90">
                    <div className="grid grid-cols-2 text-[6pt] font-bold">
                        <div className="text-left pl-3">
                            {material && (
                                <p className="lowercase">{material}</p>
                            )}
                            {color && (
                                <p className="lowercase mt-0.5">{color}</p>
                            )}
                        </div>
                        <div className="text-right pr-3">
                            <p className="truncate">{name || '—'}</p>
                            {designerLabel && (
                                <p
                                    className={`mt-4 ${
                                        keepDesignerSingleLine ? 'whitespace-nowrap' : ''
                                    }`}
                                >
                                    {designerLabel}
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

// ── Sales Panel (edit-mode only) ─────────────────────────────────────────────

function urgencyColor(createdAt: Date): string {
    const days = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24)
    if (days > 7) return '#ef4444'
    if (days >= 3) return '#eab308'
    return '#3b82f6'
}

function OrderBadge({
    label,
    createdAt,
    state,
}: {
    label: string
    createdAt: Date
    state: 'pending' | 'done' | 'cancelled'
}) {
    return (
        <div className="flex items-center gap-[5px] bg-white px-[10px] py-[7px] flex-shrink-0">
            {state === 'done' ? (
                <svg width="8" height="8" viewBox="0 0 8 8" fill="none" className="flex-shrink-0">
                    <polyline
                        points="1,4.5 3,6.5 7,2"
                        stroke="#22c55e"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                </svg>
            ) : state === 'cancelled' ? (
                <svg width="8" height="8" viewBox="0 0 8 8" fill="none" className="flex-shrink-0">
                    <line x1="1.5" y1="1.5" x2="6.5" y2="6.5" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" />
                    <line x1="6.5" y1="1.5" x2="1.5" y2="6.5" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
            ) : (
                <span
                    className="rounded-full flex-shrink-0"
                    style={{ display: 'inline-block', width: 8, height: 8, backgroundColor: urgencyColor(createdAt) }}
                />
            )}
            <span className="text-[8px] font-bold tracking-[0.09em] uppercase">
                O-{label}
            </span>
        </div>
    )
}

function SalesPanel({ orders }: { orders: OrderWithItems[] }) {
    const totalSold = orders.reduce(
        (sum, order) => sum + order.items.reduce((s, i) => s + i.quantity, 0),
        0,
    )
    const totalRevenue = orders
        .filter((o) => o.status !== 'CANCELLED')
        .reduce(
            (sum, order) =>
                sum + order.items.reduce((s, i) => s + i.price * i.quantity, 0),
            0,
        )

    return (
        <div className="space-y-4">
            {/* Summary chips — mirror the OrderBadge slab style */}
            <div className="flex gap-[6px] flex-wrap">
                <div className="flex items-center gap-[5px] bg-white px-[10px] py-[7px]">
                    <span className="text-[8px] font-bold tracking-[0.09em] uppercase">
                        {totalSold} Sold
                    </span>
                </div>
                <div className="flex items-center gap-[5px] bg-white px-[10px] py-[7px]">
                    <span className="text-[8px] font-bold tracking-[0.09em] uppercase">
                        {formatPrice(totalRevenue)} Revenue
                    </span>
                </div>
                <div className="flex items-center gap-[5px] bg-white px-[10px] py-[7px]">
                    <span className="text-[8px] font-bold tracking-[0.09em] uppercase">
                        {orders.length} {orders.length === 1 ? 'Order' : 'Orders'}
                    </span>
                </div>
            </div>

            {orders.length === 0 ? (
                <div className="text-center py-8 text-[10px] tracking-[0.1em] uppercase text-neutral-400 font-reformat">
                    No sales yet
                </div>
            ) : (
                <div className="bg-white divide-y divide-[#f4f4f4]">
                    {orders.map((order) => {
                        const units = order.items.reduce((s, i) => s + i.quantity, 0)
                        const revenue = order.items.reduce(
                            (s, i) => s + i.price * i.quantity,
                            0,
                        )
                        const state: 'pending' | 'done' | 'cancelled' =
                            order.status === 'SHIPPED'
                                ? 'done'
                                : order.status === 'CANCELLED'
                                  ? 'cancelled'
                                  : 'pending'
                        const cancelled = state === 'cancelled'

                        return (
                            <Link
                                key={order.id}
                                href={`/admin/orders/${order.id}`}
                                className={`flex items-center gap-3 px-3 py-[10px] hover:bg-neutral-50 transition-colors ${
                                    cancelled ? 'opacity-50' : ''
                                }`}
                            >
                                <OrderBadge
                                    label={order.orderNumber.slice(-3)}
                                    createdAt={order.createdAt}
                                    state={state}
                                />

                                <span className="flex-1 min-w-0 font-reformat text-[9px] tracking-[0.06em] text-neutral-500 truncate">
                                    {order.email}
                                </span>

                                <span className="font-reformat text-[9px] tracking-[0.1em] uppercase text-neutral-500 tabular-nums flex-shrink-0">
                                    ×{units}
                                </span>

                                <span
                                    className={`font-alte text-[12px] leading-none tabular-nums flex-shrink-0 w-[60px] text-right ${
                                        cancelled ? 'line-through' : ''
                                    }`}
                                >
                                    {formatPrice(revenue)}
                                </span>

                                <span className="font-reformat text-[9px] tracking-[0.06em] uppercase text-neutral-400 tabular-nums flex-shrink-0 w-[58px] text-right">
                                    {new Date(order.createdAt).toLocaleDateString(undefined, {
                                        month: 'short',
                                        day: 'numeric',
                                    })}
                                </span>
                            </Link>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
