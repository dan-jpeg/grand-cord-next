'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { createProduct, updateProduct, commitInventoryChanges } from '@/app/admin/products/actions'
import { ImageManager, type ImageData } from '@/components/admin/image-manager'
import { InventoryConfirmModal, LockIcon, type InventoryChange } from './inventory-confirm-modal'
import { formatPrice } from '@/lib/utils'
import type { Product, ProductSize, Order, OrderItem, InventoryChangeLog } from '@prisma/client'

type ProductWithSizes = Product & {
    sizes: ProductSize[]
    keywords?: string[]
}

type OrderWithItems = Order & {
    items: OrderItem[]
}

const AVAILABLE_SIZES = ['1', '2', '3', '4', '5', 'o/s']
const ONE_SIZE = 'o/s'
const MAX_DESIGNERS = 8

type Tab = 'identity' | 'look' | 'sizing' | 'listing' | 'sales' | 'history'
type TabGroup = 'listing' | 'inventory'

// Each tab belongs to one of two top-level groups. The wizard order goes
// through every tab in the Listing group first, then everything in the
// Inventory group.
const TAB_GROUP: Record<Tab, TabGroup> = {
    identity: 'listing',
    look: 'listing',
    listing: 'listing',
    sizing: 'inventory',
    sales: 'inventory',
    history: 'inventory',
}

const GROUPS: { key: TabGroup; label: string }[] = [
    { key: 'listing', label: 'Listing' },
    { key: 'inventory', label: 'Inventory' },
]

const TABS_CREATE: { key: Tab; label: string }[] = [
    { key: 'identity', label: 'Identity' },
    { key: 'look', label: 'Look' },
    { key: 'listing', label: 'Details' },
    { key: 'sizing', label: 'Inventory' },
]

const TABS_EDIT: { key: Tab; label: string }[] = [
    ...TABS_CREATE,
    { key: 'sales', label: 'Sales' },
    { key: 'history', label: 'History' },
]

const inputClass =
    'w-full px-4 py-3 bg-neutral-100 rounded-lg text-sm focus:outline-none focus:bg-neutral-200 transition-colors placeholder:text-neutral-400'

const labelClass = 'block text-sm font-bold mb-2'

export function ProductForm({
    product,
    orders,
    inventoryLogs,
    hideTabs = false,
    initialTab,
}: {
    product?: ProductWithSizes
    orders?: OrderWithItems[]
    inventoryLogs?: InventoryChangeLog[]
    hideTabs?: boolean
    initialTab?: Tab
}) {
    const router = useRouter()
    const TABS = product ? TABS_EDIT : TABS_CREATE
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [activeTab, setActiveTab] = useState<Tab>(initialTab ?? 'identity')
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
                const image = img as {
                    url?: string
                    isMobilePrimary?: boolean
                    isDesktopPrimary?: boolean
                    isCartPrimary?: boolean
                    isGrid1x1Primary?: boolean
                    isGrid2x2Primary?: boolean
                    isGrid3x3Primary?: boolean
                    showOnPdp?: boolean
                }
                return {
                    url: image.url || '',
                    isMobilePrimary: image.isMobilePrimary ?? (index === 0),
                    isDesktopPrimary: image.isDesktopPrimary ?? (index === 0),
                    isCartPrimary: image.isCartPrimary ?? (index === 0),
                    isGrid1x1Primary: image.isGrid1x1Primary ?? (index === 0),
                    isGrid2x2Primary: image.isGrid2x2Primary ?? (index === 0),
                    isGrid3x3Primary: image.isGrid3x3Primary ?? (index === 0),
                    showOnPdp: image.showOnPdp ?? true,
                }
            })
        }
        if (Array.isArray(rawImages)) {
            return rawImages.map((url: string, index: number) => ({
                url,
                isMobilePrimary: index === 0,
                isDesktopPrimary: index === 0,
                isCartPrimary: index === 0,
                isGrid1x1Primary: index === 0,
                isGrid2x2Primary: index === 0,
                isGrid3x3Primary: index === 0,
                showOnPdp: true,
            }))
        }
        return []
    })

    const [material, setMaterial] = useState(product?.material || '')
    const [color, setColor] = useState(product?.color || '')
    const [colorHex, setColorHex] = useState(product?.colorHex || '')
    const [attribute1, setAttribute1] = useState(product?.attribute1 || '')
    const [attribute2, setAttribute2] = useState(product?.attribute2 || '')

    const [sizes, setSizes] = useState<{ id?: string; size: string; available: number }[]>(
        product?.sizes.length
            ? product.sizes.map((s) => ({ id: s.id, size: s.size, available: s.available }))
            : [{ size: '1', available: 0 }]
    )

    // Server-side baseline of available counts for existing sizes; updated after
    // a successful commitInventoryChanges so the confirm modal always shows the
    // delta from the persisted value.
    const [committedAvailable, setCommittedAvailable] = useState<Record<string, number>>(
        () => Object.fromEntries((product?.sizes ?? []).map((s) => [s.id, s.available])),
    )

    // Reserved units (open-order holds) per existing size. Read-only — these
    // only move when an order is placed/cancelled, not from this form.
    const reservedById = useMemo<Record<string, number>>(
        () => Object.fromEntries((product?.sizes ?? []).map((s) => [s.id, s.committed])),
        [product],
    )

    // Snapshot of values at mount — diffed against current state to decide
    // whether the wizard's primary action shows "Save Changes". Existing-size
    // stock counts are excluded because those are persisted via the inventory
    // lock/commit flow, not the form submit.
    const initialSignatureRef = useRef<string>('')

    const currentSignature = useMemo(() => {
        return JSON.stringify({
            name: name.trim(),
            slug: slug.trim(),
            description,
            keywords: keywordsInput.split(/[,\n]/).map((k) => k.trim()).filter(Boolean),
            designerNames: designerNames.map((n) => n.trim()).filter(Boolean),
            price: price.trim(),
            published,
            material: material.trim(),
            color: color.trim(),
            colorHex: colorHex.trim(),
            attribute1: attribute1.trim(),
            attribute2: attribute2.trim(),
            images: images.map((i) => ({
                url: i.url,
                isMobilePrimary: !!i.isMobilePrimary,
                isDesktopPrimary: !!i.isDesktopPrimary,
                isCartPrimary: !!i.isCartPrimary,
                isGrid1x1Primary: !!i.isGrid1x1Primary,
                isGrid2x2Primary: !!i.isGrid2x2Primary,
                isGrid3x3Primary: !!i.isGrid3x3Primary,
                showOnPdp: !!i.showOnPdp,
            })),
            // Sizes are excluded entirely: adding/removing a size and
            // adjusting stock are inventory mutations routed through the
            // lock/commit flow below, not tracked as a form-dirty change.
        })
    }, [
        name,
        slug,
        description,
        keywordsInput,
        designerNames,
        price,
        published,
        material,
        color,
        colorHex,
        attribute1,
        attribute2,
        images,
    ])

    useEffect(() => {
        // Capture initial signature once, after first render computes it.
        if (!initialSignatureRef.current) initialSignatureRef.current = currentSignature
    }, [currentSignature])

    const isDirty = !!product && initialSignatureRef.current !== '' && currentSignature !== initialSignatureRef.current

    const [inventoryUnlocked, setInventoryUnlocked] = useState(false)
    const [inventoryConfirming, setInventoryConfirming] = useState(false)
    const [inventorySaving, setInventorySaving] = useState(false)
    // When set, the user attempted to navigate to another tab while inventory
    // changes were pending. Gates navigation behind the confirm/discard modal.
    const [pendingNavTo, setPendingNavTo] = useState<Tab | null>(null)
    // Existing sizes staged for removal (unlocked, not yet confirmed). Kept
    // out of `sizes` so they disappear from the list immediately, but
    // snapshotted here so Discard can restore them.
    const [pendingRemovals, setPendingRemovals] = useState<
        { id: string; size: string; available: number }[]
    >([])

    function updateSize(index: number, field: 'size' | 'available', value: string | number) {
        const newSizes = [...sizes]
        newSizes[index] = { ...newSizes[index], [field]: value }
        setSizes(newSizes)
    }

    function addSize() {
        // Adding a size is an inventory mutation, not a form edit — only
        // allowed while unlocked (same gate as adjusting stock counts).
        // Products being created for the first time have no lock yet.
        if (product && !inventoryUnlocked) return
        const usedSizes = sizes.map((s) => s.size)
        if (usedSizes.includes(ONE_SIZE)) return
        const availableSize = AVAILABLE_SIZES.find((s) => s !== ONE_SIZE && !usedSizes.includes(s))
        if (availableSize) setSizes([...sizes, { size: availableSize, available: 0 }])
    }

    function removeSize(index: number) {
        const item = sizes[index]
        if (item.id) {
            // Persisted size: stage for removal via the lock/commit flow
            // instead of deleting local state outright.
            if (!inventoryUnlocked) return
            setPendingRemovals((prev) => [
                ...prev,
                { id: item.id!, size: item.size, available: item.available },
            ])
        }
        setSizes((prev) => prev.filter((_, i) => i !== index))
    }

    function bumpExistingSize(sizeId: string, dir: 1 | -1) {
        setSizes((prev) =>
            prev.map((s) => {
                if (s.id !== sizeId) return s
                const next = Math.max(0, s.available + dir)
                if (next === s.available && dir < 0) return s
                return { ...s, available: next }
            }),
        )
    }

    const inventoryChanges: InventoryChange[] = sizes
        .filter((s): s is { id: string; size: string; available: number } => !!s.id)
        .map((s) => {
            const before = committedAvailable[s.id] ?? 0
            const after = s.available
            return {
                sizeId: s.id,
                sizeLabel: s.size,
                before,
                after,
                delta: after - before,
            }
        })
        .filter((c) => c.delta !== 0)

    // Unsaved new rows (no id yet) — staged additions.
    const pendingAdditions = sizes.filter((s): s is { size: string; available: number } => !s.id)

    const additionChanges: InventoryChange[] = pendingAdditions.map((s, i) => ({
        sizeId: `new-${i}`,
        sizeLabel: s.size,
        before: 0,
        after: s.available,
        delta: s.available,
        kind: 'add',
    }))

    const removalChanges: InventoryChange[] = pendingRemovals.map((s) => ({
        sizeId: s.id,
        sizeLabel: s.size,
        before: s.available,
        after: 0,
        delta: -s.available,
        kind: 'remove',
    }))

    const allInventoryChanges: InventoryChange[] = [
        ...inventoryChanges,
        ...additionChanges,
        ...removalChanges,
    ]

    const hasInventoryChanges = allInventoryChanges.length > 0

    function handleLockClick() {
        if (!inventoryUnlocked) {
            setInventoryUnlocked(true)
            return
        }
        if (!hasInventoryChanges) {
            setInventoryUnlocked(false)
            return
        }
        setInventoryConfirming(true)
    }

    async function handleInventoryConfirm() {
        if (!product) return
        setInventorySaving(true)
        try {
            const result = await commitInventoryChanges(
                product.id,
                inventoryChanges.map((c) => ({ sizeId: c.sizeId, delta: c.delta })),
                pendingAdditions.map((s) => ({ size: s.size, available: s.available })),
                pendingRemovals.map((s) => s.id),
            )
            setCommittedAvailable((prev) => {
                const next = { ...prev }
                for (const c of inventoryChanges) next[c.sizeId] = c.after
                for (const s of result.createdSizes) next[s.id] = s.available
                for (const s of pendingRemovals) delete next[s.id]
                return next
            })
            setSizes((prev) => {
                const createdByLabel = new Map(result.createdSizes.map((s) => [s.size, s]))
                return prev
                    .filter((s) => !!s.id || createdByLabel.has(s.size))
                    .map((s) => {
                        if (s.id) return s
                        const created = createdByLabel.get(s.size)!
                        return { id: created.id, size: created.size, available: created.available }
                    })
            })
            setPendingRemovals([])
            setInventoryConfirming(false)
            setInventoryUnlocked(false)
            if (pendingNavTo) {
                setActiveTab(pendingNavTo)
                setPendingNavTo(null)
            }
        } finally {
            setInventorySaving(false)
        }
    }

    function handleInventoryDiscard() {
        setSizes((prev) => {
            const reverted = prev
                .filter((s) => !!s.id)
                .map((s) => {
                    const base = committedAvailable[s.id!]
                    if (base === undefined) return s
                    return { ...s, available: base }
                })
            const restored = pendingRemovals.map((s) => ({ id: s.id, size: s.size, available: s.available }))
            return [...reverted, ...restored]
        })
        setPendingRemovals([])
        setInventoryConfirming(false)
        setInventoryUnlocked(false)
        if (pendingNavTo) {
            setActiveTab(pendingNavTo)
            setPendingNavTo(null)
        }
    }

    function handleInventoryCancel() {
        setInventoryConfirming(false)
        setPendingNavTo(null)
    }

    // Warn before leaving the page entirely (tab close, refresh, manual URL
    // change, browser back) while inventory changes are pending.
    useEffect(() => {
        if (!hasInventoryChanges) return
        function handler(e: BeforeUnloadEvent) {
            e.preventDefault()
            e.returnValue = ''
        }
        window.addEventListener('beforeunload', handler)
        return () => window.removeEventListener('beforeunload', handler)
    }, [hasInventoryChanges])

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

    const errors = warnings.filter((w) => w.severity === 'error')

    // If the user has pending inventory deltas while on the Inventory tab and
    // tries to leave, gate the navigation behind the confirm/discard modal.
    function guardNav(target: Tab): boolean {
        if (activeTab === 'sizing' && hasInventoryChanges) {
            setPendingNavTo(target)
            setInventoryConfirming(true)
            return true
        }
        return false
    }

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
        if (guardNav(key)) return
        setWarnings([])
        setActiveTab(key)
    }

    function goBack() {
        const prev = TABS[tabIndex - 1]
        if (!prev) return
        if (guardNav(prev.key)) return
        setWarnings([])
        setActiveTab(prev.key)
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
        const next = TABS[tabIndex + 1]
        if (!next) return
        if (guardNav(next.key)) return
        setWarnings([])
        setActiveTab(next.key)
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
            attribute1: attribute1 || undefined,
            attribute2: attribute2 || undefined,
            price: Number(price),
            published,
            images,
            sizes: sizes.filter((s) => s.size),
        }
        if (product) {
            try {
                await updateProduct(product.id, data)
                // Reset the dirty baseline so "Save Changes" goes idle, and
                // pull fresh server state in case any field was normalized
                // (e.g. auto-generated slug).
                initialSignatureRef.current = currentSignature
                setWarnings([])
                router.refresh()
            } finally {
                setIsSubmitting(false)
            }
        } else {
            await createProduct(data)
        }
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-6">

            {/* ── Tab bar (two-level: top groups + sub-tabs) ── */}
            {!hideTabs && (() => {
                const activeGroup = TAB_GROUP[activeTab]
                const subTabs = TABS.filter((t) => TAB_GROUP[t.key] === activeGroup)
                return (
                    <div className="space-y-3 border-b border-neutral-100 pb-3">
                        <div className="flex items-baseline gap-5 flex-wrap">
                            {GROUPS.map((g) => {
                                const firstSubTab = TABS.find((t) => TAB_GROUP[t.key] === g.key)
                                if (!firstSubTab) return null
                                return (
                                    <button
                                        key={g.key}
                                        type="button"
                                        onClick={() => {
                                            if (activeGroup === g.key) return
                                            jumpToTab(firstSubTab.key)
                                        }}
                                        className="font-alte text-[26px] leading-none tracking-[-0.02em] text-black transition-opacity active:opacity-60"
                                        style={{ opacity: activeGroup === g.key ? 1 : 0.18 }}
                                    >
                                        {g.label}
                                    </button>
                                )
                            })}
                        </div>
                        {subTabs.length > 1 && (
                            <div className="flex items-baseline gap-4 flex-wrap">
                                {subTabs.map((t) => (
                                    <button
                                        key={t.key}
                                        type="button"
                                        onClick={() => jumpToTab(t.key)}
                                        className="font-reformat text-[11px] tracking-[0.12em] uppercase text-black transition-opacity active:opacity-60"
                                        style={{ opacity: activeTab === t.key ? 1 : 0.32 }}
                                    >
                                        {t.label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )
            })()}

            {/* ── Identity ── */}
            {activeTab === 'identity' && (
                <div className="space-y-5">
                    <div>
                        <p className="text-sm font-bold mb-3">Product Images:</p>
                        {product ? (
                            <div className="flex items-center justify-between gap-4">
                                <div className="flex gap-2 overflow-x-auto">
                                    {images.slice(0, 6).map((image, index) => (
                                        <div
                                            key={image.url + index}
                                            className="relative w-12 h-14 shrink-0 bg-neutral-100 overflow-hidden"
                                        >
                                            <Image src={image.url} alt="" fill className="object-cover" />
                                        </div>
                                    ))}
                                    {images.length === 0 && (
                                        <p className="text-xs text-neutral-400">No images yet</p>
                                    )}
                                </div>
                                <Link
                                    href={`/admin/products/${product.id}/images`}
                                    className="text-xs font-bold underline underline-offset-2 whitespace-nowrap"
                                >
                                    Manage Images →
                                </Link>
                            </div>
                        ) : (
                            <ImageManager images={images} onChange={setImages} />
                        )}
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
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="attribute1" className={labelClass}>Attribute 1:</label>
                            <input
                                id="attribute1"
                                type="text"
                                value={attribute1}
                                onChange={(e) => setAttribute1(e.target.value)}
                                placeholder="Shown above description on PDP"
                                className={inputClass}
                            />
                        </div>
                        <div>
                            <label htmlFor="attribute2" className={labelClass}>Attribute 2:</label>
                            <input
                                id="attribute2"
                                type="text"
                                value={attribute2}
                                onChange={(e) => setAttribute2(e.target.value)}
                                placeholder="Shown above description on PDP"
                                className={inputClass}
                            />
                        </div>
                    </div>

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
                        <div className="flex items-center gap-4">
                            <button
                                type="button"
                                onClick={addSize}
                                disabled={
                                    (!!product && !inventoryUnlocked) ||
                                    sizes.length >= AVAILABLE_SIZES.length - 1 ||
                                    sizes.some((s) => s.size === ONE_SIZE)
                                }
                                title={product && !inventoryUnlocked ? 'Unlock inventory to add a size' : undefined}
                                className="text-xs underline hover:no-underline disabled:opacity-40"
                            >
                                Add Size
                            </button>
                            {product && (
                                <button
                                    type="button"
                                    onClick={handleLockClick}
                                    className="p-[6px] text-neutral-400 hover:text-black"
                                    aria-label={inventoryUnlocked ? 'Lock inventory controls' : 'Unlock inventory controls'}
                                    aria-pressed={inventoryUnlocked}
                                >
                                    <LockIcon unlocked={inventoryUnlocked} />
                                </button>
                            )}
                        </div>
                    </div>
                    <div className="space-y-3">
                        {sizes.map((sizeItem, index) => {
                            const isExisting = !!sizeItem.id
                            const base = isExisting ? committedAvailable[sizeItem.id!] ?? 0 : 0
                            const delta = isExisting ? sizeItem.available - base : 0
                            return (
                                <div key={sizeItem.id ?? `new-${index}`} className="flex items-center gap-3">
                                    <select
                                        value={sizeItem.size}
                                        onChange={(e) => updateSize(index, 'size', e.target.value)}
                                        disabled={isExisting}
                                        className="px-4 py-3 bg-neutral-100 rounded-lg text-sm focus:outline-none focus:bg-neutral-200 transition-colors disabled:opacity-60"
                                    >
                                        {AVAILABLE_SIZES.map((size) => (
                                            <option
                                                key={size}
                                                value={size}
                                                disabled={size === ONE_SIZE && sizes.length > 1}
                                            >
                                                {size}
                                            </option>
                                        ))}
                                    </select>
                                    {isExisting ? (
                                        <div className="flex-1 flex items-center justify-between bg-neutral-100 rounded-lg px-4 py-3">
                                            <button
                                                type="button"
                                                onClick={() => bumpExistingSize(sizeItem.id!, -1)}
                                                disabled={!inventoryUnlocked || sizeItem.available === 0}
                                                className="text-neutral-500 hover:text-black disabled:opacity-20 px-2 text-base leading-none"
                                                aria-label={`Decrease ${sizeItem.size}`}
                                            >
                                                −
                                            </button>
                                            <span
                                                className={`font-alte tabular-nums text-base leading-none ${
                                                    delta !== 0 ? 'font-bold text-black' : ''
                                                }`}
                                            >
                                                {sizeItem.available}
                                                {delta !== 0 && (
                                                    <span
                                                        className={`ml-2 text-[10px] font-reformat tracking-[0.05em] ${
                                                            delta > 0 ? 'text-[#1a7a1a]' : 'text-[#a02020]'
                                                        }`}
                                                    >
                                                        ({delta > 0 ? '+' : ''}
                                                        {delta})
                                                    </span>
                                                )}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => bumpExistingSize(sizeItem.id!, 1)}
                                                disabled={!inventoryUnlocked}
                                                className="text-neutral-500 hover:text-black disabled:opacity-20 px-2 text-base leading-none"
                                                aria-label={`Increase ${sizeItem.size}`}
                                            >
                                                +
                                            </button>
                                        </div>
                                    ) : (
                                        <input
                                            type="number"
                                            min="0"
                                            value={sizeItem.available}
                                            onChange={(e) => updateSize(index, 'available', Number(e.target.value))}
                                            className={`${inputClass} flex-1`}
                                            placeholder="Available"
                                        />
                                    )}
                                    {(() => {
                                        const committedStock = isExisting
                                            ? committedAvailable[sizeItem.id!] ?? 0
                                            : 0
                                        const reserved = isExisting ? reservedById[sizeItem.id!] ?? 0 : 0
                                        const hasUncommittedEdit = isExisting && delta !== 0
                                        const lockedForExisting = isExisting && !!product && !inventoryUnlocked
                                        const blocked =
                                            lockedForExisting || committedStock > 0 || reserved > 0 || hasUncommittedEdit
                                        const blockReason =
                                            lockedForExisting
                                                ? 'Unlock inventory to remove a size'
                                                : reserved > 0
                                                ? `${reserved} unit(s) reserved by open orders — cancel/fulfill first`
                                                : committedStock > 0
                                                  ? `Has ${committedStock} in stock — unlock inventory, decrement to 0, and confirm changes first`
                                                  : hasUncommittedEdit
                                                    ? 'Uncommitted inventory edit — confirm or discard it first'
                                                    : undefined
                                        return (
                                            <button
                                                type="button"
                                                onClick={() => removeSize(index)}
                                                disabled={sizes.length === 1 || blocked}
                                                title={blockReason}
                                                className="text-xs text-neutral-400 hover:text-red-500 underline hover:no-underline disabled:opacity-30 disabled:no-underline disabled:cursor-not-allowed whitespace-nowrap"
                                            >
                                                Remove
                                            </button>
                                        )
                                    })()}
                                </div>
                            )
                        })}
                    </div>
                    {product && (
                        <p className="text-[10px] font-reformat tracking-[0.05em] text-neutral-400">
                            {inventoryUnlocked
                                ? 'Inventory unlocked — adjust stock, add, or remove sizes, then lock to confirm and log.'
                                : 'Inventory locked. Click the lock to make changes.'}
                        </p>
                    )}
                </div>
            )}

            {/* Inventory confirmation modal */}
            {inventoryConfirming && product && (
                <InventoryConfirmModal
                    productName={product.name}
                    changes={allInventoryChanges}
                    saving={inventorySaving}
                    onConfirm={handleInventoryConfirm}
                    onCancel={handleInventoryCancel}
                    onDiscard={handleInventoryDiscard}
                />
            )}

            {/* ── Listing ── */}
            {activeTab === 'listing' && (
                <div className="grid grid-cols-2 gap-x-5 gap-y-5">
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

                    <div className="col-span-2">
                        <label htmlFor="description" className={labelClass}>Description:</label>
                        <textarea
                            id="description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={4}
                            className={`${inputClass} resize-none`}
                        />
                    </div>

                    <div className="col-span-2">
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

                    <div className="col-span-2 pt-3 border-t border-neutral-100">
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

            {/* ── History (edit-only) ── */}
            {activeTab === 'history' && product && (
                <InventoryHistoryPanel logs={inventoryLogs ?? []} />
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
                    {product && isDirty ? (
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="text-sm font-bold underline hover:no-underline disabled:opacity-40"
                        >
                            {isSubmitting ? 'Saving...' : 'Save Changes'}
                        </button>
                    ) : isLastTab ? (
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

function InventoryHistoryPanel({ logs }: { logs: InventoryChangeLog[] }) {
    if (logs.length === 0) {
        return (
            <div className="text-center py-8 text-[10px] tracking-[0.1em] uppercase text-neutral-400 font-reformat">
                No inventory changes yet
            </div>
        )
    }

    const totalAdded = logs
        .filter((l) => l.delta > 0)
        .reduce((s, l) => s + l.delta, 0)
    const totalRemoved = logs
        .filter((l) => l.delta < 0)
        .reduce((s, l) => s + Math.abs(l.delta), 0)

    return (
        <div className="space-y-4">
            <div className="flex gap-[6px] flex-wrap">
                <div className="flex items-center gap-[5px] bg-white px-[10px] py-[7px]">
                    <span className="text-[8px] font-bold tracking-[0.09em] uppercase">
                        +{totalAdded} Added
                    </span>
                </div>
                <div className="flex items-center gap-[5px] bg-white px-[10px] py-[7px]">
                    <span className="text-[8px] font-bold tracking-[0.09em] uppercase">
                        −{totalRemoved} Removed
                    </span>
                </div>
                <div className="flex items-center gap-[5px] bg-white px-[10px] py-[7px]">
                    <span className="text-[8px] font-bold tracking-[0.09em] uppercase">
                        {logs.length} {logs.length === 1 ? 'Entry' : 'Entries'}
                    </span>
                </div>
            </div>

            <div className="bg-white divide-y divide-[#f4f4f4]">
                {logs.map((log) => (
                    <div key={log.id} className="flex items-center gap-3 px-3 py-[10px]">
                        <span className="font-reformat text-[9px] tracking-[0.1em] uppercase font-bold w-[36px] flex-shrink-0">
                            {log.sizeLabel}
                        </span>
                        <span className="font-alte text-[12px] tabular-nums flex items-center gap-1 flex-shrink-0">
                            <span className="text-neutral-400">{log.before}</span>
                            <span className="text-neutral-400">→</span>
                            <span>{log.after}</span>
                        </span>
                        <span
                            className={`font-reformat text-[10px] tracking-[0.05em] font-bold flex-shrink-0 ${
                                log.delta > 0 ? 'text-[#1a7a1a]' : 'text-[#a02020]'
                            }`}
                        >
                            {log.delta > 0 ? '+' : ''}
                            {log.delta}
                        </span>
                        <span className="flex-1 min-w-0 font-reformat text-[9px] tracking-[0.06em] text-neutral-500 truncate text-right">
                            {log.adminName || log.adminEmail}
                        </span>
                        <span className="font-reformat text-[9px] tracking-[0.06em] uppercase text-neutral-400 tabular-nums flex-shrink-0 w-[72px] text-right">
                            {new Date(log.createdAt).toLocaleDateString(undefined, {
                                month: 'short',
                                day: 'numeric',
                            })}
                            {' · '}
                            {new Date(log.createdAt).toLocaleTimeString(undefined, {
                                hour: 'numeric',
                                minute: '2-digit',
                            })}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    )
}
