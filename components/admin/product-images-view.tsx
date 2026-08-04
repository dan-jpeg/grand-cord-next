'use client'

import { useLayoutEffect, useRef, useState, useTransition } from 'react'
import { motion, Reorder, LayoutGroup, type PanInfo } from 'framer-motion'
import Link from 'next/link'
import Image from 'next/image'
import { useUploadThing } from '@/lib/uploadthing'
import { updateProductImages, type ImageRecord } from '@/app/admin/products/[id]/images/actions'
import { ProductMobileHeader } from '@/components/admin/product-mobile-header'

type ProductLite = { id: string; name: string; slug: string }

type RoleKey =
    | 'isGrid1x1Primary'
    | 'isGrid2x2Primary'
    | 'isGrid3x3Primary'
    | 'isMobilePrimary'
    | 'isDesktopPrimary'
    | 'isInventoryPrimary'

const CATALOG_TAGS: { key: RoleKey; shortcut: string; label: string; overlay: string }[] = [
    { key: 'isGrid1x1Primary', shortcut: '1', label: '1x1', overlay: '1x1' },
    { key: 'isGrid2x2Primary', shortcut: '2', label: '2x2', overlay: '2x2' },
    { key: 'isGrid3x3Primary', shortcut: '3', label: '3x3', overlay: '3x3' },
    { key: 'isMobilePrimary', shortcut: 'm', label: 'mobile', overlay: 'Mobile' },
    { key: 'isDesktopPrimary', shortcut: 'd', label: 'desktop', overlay: 'Desktop' },
    { key: 'isInventoryPrimary', shortcut: 'i', label: 'inventory', overlay: 'Inventory' },
]

// Display order for the mobile detail view's designation row (Figma 1888:281).
const DETAIL_TAGS: { key: RoleKey; label: string }[] = [
    { key: 'isMobilePrimary', label: 'Mobile' },
    { key: 'isGrid1x1Primary', label: '1x1' },
    { key: 'isDesktopPrimary', label: 'Desktop' },
    { key: 'isGrid2x2Primary', label: '2x2' },
    { key: 'isInventoryPrimary', label: 'Inventory' },
    { key: 'isGrid3x3Primary', label: '3x3' },
]

const detailSpring = { type: 'spring', stiffness: 320, damping: 34 } as const

function withFallbackRoles(next: ImageRecord[]): ImageRecord[] {
    if (next.length === 0) return next
    if (!next.some((img) => img.isMobilePrimary)) next[0].isMobilePrimary = true
    if (!next.some((img) => img.isDesktopPrimary)) next[0].isDesktopPrimary = true
    if (!next.some((img) => img.isCartPrimary)) next[0].isCartPrimary = true
    if (!next.some((img) => img.isGrid1x1Primary)) next[0].isGrid1x1Primary = true
    if (!next.some((img) => img.isGrid2x2Primary)) next[0].isGrid2x2Primary = true
    if (!next.some((img) => img.isGrid3x3Primary)) next[0].isGrid3x3Primary = true
    return next
}

function RadioDot({ filled, shortcut }: { filled: boolean; shortcut?: string }) {
    return (
        <span
            className={`inline-flex items-center justify-center w-[14px] h-[14px] shrink-0 rounded-full border border-black ${
                filled ? 'bg-black' : 'bg-white'
            }`}
        >
            {shortcut && (
                <span className={`text-[7px] font-bold leading-none ${filled ? 'text-white' : 'text-black'}`}>
                    {shortcut}
                </span>
            )}
        </span>
    )
}

export function ProductImagesView({
    product,
    initialImages,
}: {
    product: ProductLite
    initialImages: ImageRecord[]
}) {
    const [images, setImages] = useState<ImageRecord[]>(initialImages)
    const [selectedIndex, setSelectedIndex] = useState(0)
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
    // Mobile detail view's info sheet — drag it down to collapse (leaving a
    // thin strip pinned to the bottom of the screen), tap that strip to expand.
    const [detailCollapsed, setDetailCollapsed] = useState(false)
    const [panelCollapsedY, setPanelCollapsedY] = useState(0)
    const panelRef = useRef<HTMLDivElement>(null)
    const DETAIL_STRIP_HEIGHT = 28
    useLayoutEffect(() => {
        if (panelRef.current) {
            setPanelCollapsedY(Math.max(panelRef.current.scrollHeight - DETAIL_STRIP_HEIGHT, 0))
        }
    }, [selectedIndex, mobileMenuOpen])
    // The list and detail views are two separately-mounted scroll containers,
    // so closing the detail view would otherwise reset scroll to the top —
    // restore it before paint so the closing thumbnail doesn't jump.
    const mobileListRef = useRef<HTMLDivElement>(null)
    const mobileListScrollTop = useRef(0)
    useLayoutEffect(() => {
        if (!mobileMenuOpen && mobileListRef.current) {
            mobileListRef.current.scrollTop = mobileListScrollTop.current
        }
    }, [mobileMenuOpen])
    const [isUploading, setIsUploading] = useState(false)
    const [isReplacing, setIsReplacing] = useState(false)
    const [reorderOpen, setReorderOpen] = useState(false)
    const [reorderList, setReorderList] = useState<ImageRecord[]>([])
    const [pending, startTransition] = useTransition()
    const { startUpload } = useUploadThing('productImage')

    const selected = images[selectedIndex]

    function persist(next: ImageRecord[]) {
        setImages(next)
        startTransition(async () => {
            await updateProductImages(product.id, next)
        })
    }

    async function handleUploadNew(e: React.ChangeEvent<HTMLInputElement>) {
        const files = e.target.files
        if (!files || files.length === 0) return
        setIsUploading(true)
        try {
            const res = await startUpload(Array.from(files))
            if (res) {
                const firstNewIndex = images.length
                const additions: ImageRecord[] = res.map((file, i) => ({
                    url: file.url,
                    isMobilePrimary: images.length === 0 && i === 0,
                    isDesktopPrimary: images.length === 0 && i === 0,
                    isCartPrimary: images.length === 0 && i === 0,
                    isGrid1x1Primary: images.length === 0 && i === 0,
                    isGrid2x2Primary: images.length === 0 && i === 0,
                    isGrid3x3Primary: images.length === 0 && i === 0,
                    showOnPdp: true,
                }))
                persist([...images, ...additions])
                setSelectedIndex(firstNewIndex)
            }
        } catch {
            alert('Upload failed')
        } finally {
            setIsUploading(false)
            e.target.value = ''
        }
    }

    async function handleReplace(e: React.ChangeEvent<HTMLInputElement>) {
        const files = e.target.files
        if (!files || files.length === 0 || !selected) return
        setIsReplacing(true)
        try {
            const res = await startUpload(Array.from(files).slice(0, 1))
            if (res && res[0]) {
                persist(images.map((img, i) => (i === selectedIndex ? { ...img, url: res[0].url } : img)))
            }
        } catch {
            alert('Upload failed')
        } finally {
            setIsReplacing(false)
            e.target.value = ''
        }
    }

    function setTag(role: RoleKey) {
        persist(images.map((img, i) => ({ ...img, [role]: i === selectedIndex })))
    }

    // Mobile detail view only: unlike the desktop list (where reassigning a role
    // to a different image is how you "clear" it from this one), the mobile
    // detail view only ever shows one image, so tapping an already-assigned
    // designation needs to actually turn it off instead of being a no-op.
    function toggleTag(role: RoleKey) {
        const turningOn = !images[selectedIndex]?.[role]
        persist(
            images.map((img, i) => {
                if (turningOn) return { ...img, [role]: i === selectedIndex }
                return i === selectedIndex ? { ...img, [role]: false } : img
            }),
        )
    }

    function setPdpVisible(visible: boolean) {
        persist(images.map((img, i) => (i === selectedIndex ? { ...img, showOnPdp: visible } : img)))
    }

    function openReorder() {
        setReorderList(images)
        setReorderOpen(true)
    }

    function confirmReorder() {
        persist(reorderList)
        setReorderOpen(false)
    }

    function removeSelected() {
        if (!confirm('Are you sure you want to delete this image? This can\'t be undone.')) return
        const next = withFallbackRoles(images.filter((_, i) => i !== selectedIndex))
        persist(next)
        setSelectedIndex((i) => Math.min(i, Math.max(next.length - 1, 0)))
        setMobileMenuOpen(false)
    }

    return (
        <div className="absolute inset-0 bg-white font-alte flex flex-col">
            {/* Shared fixed mobile header (save status, name badge, tab bar). */}
            <ProductMobileHeader
                productId={product.id}
                productSlug={product.slug}
                name={product.name}
                active="images"
                status={pending ? 'saving' : 'idle'}
                hiddenClass="md:hidden"
            />

            {/* Desktop header — product badge row, full-width divider, then Listing/Inventory/Images tabs.
                The box's left border spans both rows, crossing over the divider. */}
            <div className="hidden md:flex h-10 shrink-0 justify-end">
                <div className="w-[240px] border-l border-black pl-4 pr-8 md:pr-4 flex items-center justify-end">
                    <Link
                        href={`/admin/products/${product.id}/edit`}
                        className="bg-neutral-200 px-1 text-[12px] font-bold"
                    >
                        {product.name}
                    </Link>
                </div>
            </div>

            <div className="hidden md:block h-px shrink-0 bg-black" />

            <div className="hidden md:flex h-8 shrink-0 justify-end">
                <div className="w-[240px] border-l border-b border-black pl-4 pr-8 md:pr-4 flex items-center">
                    <nav className="flex gap-4 justify-end text-[12px] font-bold w-full">
                        <Link
                            href={`/admin/products/${product.id}/edit?tab=identity`}
                            className="opacity-40 transition-opacity duration-150 hover:opacity-100"
                        >
                            Listing
                        </Link>
                        <Link
                            href={`/admin/products/${product.id}/edit?tab=sizing`}
                            className="opacity-40 transition-opacity duration-150 hover:opacity-100"
                        >
                            Inventory
                        </Link>
                        <span className="underline underline-offset-2 transition-opacity duration-150 hover:opacity-70">
                            Images
                        </span>
                    </nav>
                </div>
            </div>

            {/* Mobile — list of images (Figma 1888:312); tapping one morphs it into
                a full-width detail view with designations, PDP visibility and
                notes (Figma 1888:281). */}
            <LayoutGroup>
            {!mobileMenuOpen ? (
                <div ref={mobileListRef} className="md:hidden flex-1 overflow-y-auto px-4 pt-[120px] pb-8">
                    <div className="flex justify-end items-center gap-4 mb-4">
                        {images.length > 1 && (
                            <button
                                type="button"
                                onClick={openReorder}
                                className="text-[12px] font-bold opacity-40 active:opacity-70"
                            >
                                Reorder
                            </button>
                        )}
                        <input
                            type="file"
                            multiple
                            accept="image/*"
                            onChange={handleUploadNew}
                            disabled={isUploading}
                            className="hidden"
                            id="images-upload-new-mobile"
                        />
                        <label
                            htmlFor="images-upload-new-mobile"
                            className={`text-[12px] font-bold cursor-pointer opacity-40 active:opacity-70 ${
                                isUploading ? 'cursor-wait' : ''
                            }`}
                        >
                            {isUploading ? 'Uploading…' : 'Upload New'}
                        </label>
                    </div>

                    {images.length === 0 ? (
                        <div className="w-full py-16 flex items-center justify-center text-[12px] text-neutral-400">
                            No images yet
                        </div>
                    ) : (
                        <div className="flex flex-col gap-8">
                            {images.map((img, i) => {
                                const assigned = CATALOG_TAGS.filter(({ key }) => img[key])
                                return (
                                    <motion.button
                                        key={img.url + i}
                                        type="button"
                                        layoutId={`pimg-${i}`}
                                        transition={detailSpring}
                                        onClick={() => {
                                            mobileListScrollTop.current = mobileListRef.current?.scrollTop ?? 0
                                            setSelectedIndex(i)
                                            setDetailCollapsed(false)
                                            setMobileMenuOpen(true)
                                        }}
                                        className="relative aspect-[251/317] w-full"
                                    >
                                        <Image src={img.url} alt="" fill sizes="100vw" className="object-cover" />
                                        {assigned.length > 0 && (
                                            <span className="absolute top-2 left-2 flex flex-wrap gap-x-2 text-[12px] font-bold text-black text-left">
                                                {assigned.map(({ key, overlay }) => (
                                                    <span key={key}>{overlay}</span>
                                                ))}
                                            </span>
                                        )}
                                    </motion.button>
                                )
                            })}
                        </div>
                    )}
                </div>
            ) : selected ? (
                <div className="md:hidden fixed inset-0 z-50 bg-white overflow-hidden">
                    {/* Full-width image, pinned to the top — tap to close back to the list. */}
                    <motion.button
                        type="button"
                        layoutId={`pimg-${selectedIndex}`}
                        transition={detailSpring}
                        onClick={() => setMobileMenuOpen(false)}
                        aria-label="Close"
                        className="absolute inset-x-0 top-0 w-full aspect-[251/317]"
                    >
                        <Image src={selected.url} alt="" fill sizes="100vw" className="object-cover" priority />
                    </motion.button>

                    {/* Info sheet — sits on top of the image (not pushed below it) and never
                        scrolls. Drag it down to collapse (leaving a thin strip pinned to
                        the bottom of the screen); tap that strip to expand it again. */}
                    <motion.div
                        ref={panelRef}
                        drag="y"
                        dragConstraints={{ top: 0, bottom: panelCollapsedY }}
                        dragElastic={0.1}
                        animate={{ y: detailCollapsed ? panelCollapsedY : 0 }}
                        transition={detailSpring}
                        onDragEnd={(_, info: PanInfo) => {
                            const shouldCollapse = info.offset.y > panelCollapsedY / 3 || info.velocity.y > 500
                            setDetailCollapsed(shouldCollapse)
                        }}
                        onClick={() => {
                            if (detailCollapsed) setDetailCollapsed(false)
                        }}
                        className="absolute inset-x-0 bottom-0 bg-white flex flex-col px-4 pt-3 pb-6"
                        style={{ touchAction: 'none' }}
                    >
                        {/* Designations — bold when assigned to this image, faded otherwise. */}
                        <div className="flex items-center justify-between flex-wrap gap-y-2">
                            {DETAIL_TAGS.map(({ key, label }) => (
                                <button
                                    key={key}
                                    type="button"
                                    disabled={pending}
                                    onClick={() => toggleTag(key)}
                                    className={`text-[12px] font-bold ${selected[key] ? '' : 'opacity-20'}`}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>

                        {/* Show on PDP? — bullet + Yes/No, tap to toggle. */}
                        <button
                            type="button"
                            disabled={pending}
                            onClick={() => setPdpVisible(!selected.showOnPdp)}
                            className="flex items-center gap-2 mt-8 text-[12px] font-bold"
                        >
                            <span className="opacity-54">Show on PDP?</span>
                            <span className="inline-flex items-center gap-1.5">
                                <span className="inline-block w-[6px] h-[6px] rounded-full bg-black shrink-0" />
                                {selected.showOnPdp ? 'Yes' : 'No'}
                            </span>
                        </button>

                        {/* Notes — free text, persists on blur. Fixed height (not flex-grow)
                            since this panel no longer scrolls. */}
                        <div className="mt-8 flex flex-col">
                            <span className="text-[12px] font-bold">Notes:</span>
                            <textarea
                                value={selected.notes ?? ''}
                                onChange={(e) =>
                                    setImages((prev) =>
                                        prev.map((img, i) => (i === selectedIndex ? { ...img, notes: e.target.value } : img)),
                                    )
                                }
                                onBlur={() => persist(images)}
                                placeholder="Add notes"
                                rows={2}
                                className="mt-2 resize-none outline-none bg-transparent text-[12px] font-bold placeholder:opacity-20"
                            />
                        </div>

                        {/* Replace / Delete — Replace left, Delete centered in the row. */}
                        <div className="relative flex items-center pt-4">
                            <input
                                type="file"
                                accept="image/*"
                                onChange={handleReplace}
                                disabled={isReplacing}
                                className="hidden"
                                id="images-replace-mobile"
                            />
                            <label
                                htmlFor="images-replace-mobile"
                                className={`text-[12px] font-bold cursor-pointer active:opacity-60 ${
                                    isReplacing ? 'cursor-wait opacity-40' : ''
                                }`}
                            >
                                {isReplacing ? 'Uploading…' : 'Replace'}
                            </label>
                            <button
                                type="button"
                                disabled={pending}
                                onClick={removeSelected}
                                className="absolute left-1/2 top-4 -translate-x-1/2 text-[12px] font-bold px-1 py-0.5 bg-[rgba(255,197,197,0.4)] active:bg-[rgba(255,197,197,0.7)]"
                            >
                                Delete
                            </button>
                        </div>
                    </motion.div>
                </div>
            ) : null}
            </LayoutGroup>

            <div className="hidden md:flex flex-1 overflow-hidden">
                {/* Selection grid — 3 columns, contiguous rows, radio dot marks the previewed image */}
                <div className="h-full flex-[1.4] shrink-0 overflow-y-auto p-4">
                    {images.length === 0 ? (
                        <div className="w-full h-full flex items-center justify-center text-[12px] text-neutral-400">
                            No images yet
                        </div>
                    ) : (
                        <div className="grid grid-cols-3 gap-x-[3px] gap-y-0">
                            {images.map((img, i) => (
                                <button
                                    key={img.url + i}
                                    type="button"
                                    onClick={() => setSelectedIndex(i)}
                                    className="relative aspect-[157/224]"
                                >
                                    <Image src={img.url} alt="" fill sizes="(min-width: 768px) 15vw, 33vw" className="object-contain p-3" />
                                    <span className="absolute top-1.5 right-1.5">
                                        <RadioDot filled={i === selectedIndex} />
                                    </span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Big preview */}
                <div className="h-full flex-[1.4] pt-4 pb-4 px-4">
                    <div className="relative w-full h-full">
                        {selected?.url ? (
                            <Image src={selected.url} alt="" fill sizes="(min-width: 768px) 47vw, 100vw" className="object-contain" priority />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-[12px] text-neutral-400">
                                No images yet
                            </div>
                        )}
                    </div>
                </div>

                {/* Controls */}
                <div className="w-[260px] shrink-0 flex flex-col overflow-y-auto pl-8 md:pl-4 pr-8 md:pr-4 py-8">
                    <div className="flex justify-end items-center gap-4">
                        {images.length > 1 && (
                            <button
                                type="button"
                                onClick={openReorder}
                                className="text-[12px] font-bold opacity-40 hover:opacity-70"
                            >
                                Reorder
                            </button>
                        )}
                        <input
                            type="file"
                            multiple
                            accept="image/*"
                            onChange={handleUploadNew}
                            disabled={isUploading}
                            className="hidden"
                            id="images-upload-new"
                        />
                        <label
                            htmlFor="images-upload-new"
                            className={`text-[12px] font-bold cursor-pointer opacity-40 hover:opacity-70 ${
                                isUploading ? 'cursor-wait' : ''
                            }`}
                        >
                            {isUploading ? 'Uploading…' : 'Upload New'}
                        </label>
                    </div>

                    <div className="flex-1" />

                    {selected && (
                        <>
                            <div className="flex flex-col gap-2.5 items-start mb-10">
                                {CATALOG_TAGS.map(({ key, shortcut, label }) => (
                                    <button
                                        key={key}
                                        type="button"
                                        disabled={pending}
                                        onClick={() => setTag(key)}
                                        className="flex items-center gap-2 text-[12px] font-bold"
                                    >
                                        <RadioDot filled={!!selected[key]} shortcut={shortcut} />
                                        {label}
                                    </button>
                                ))}
                            </div>

                            <button
                                type="button"
                                disabled={pending}
                                onClick={() => setPdpVisible(!selected.showOnPdp)}
                                className="flex items-center gap-2 text-[12px] font-bold mb-10"
                            >
                                <RadioDot filled={selected.showOnPdp} />
                                Show on product page?
                            </button>

                            {/* Delete / Replace */}
                            <div className="flex items-center justify-end gap-6 mt-auto">
                                <button
                                    type="button"
                                    disabled={pending}
                                    onClick={removeSelected}
                                    className="text-[12px] font-bold px-1 py-0.5 bg-[rgba(255,197,197,0.4)] hover:bg-[rgba(255,197,197,0.7)]"
                                >
                                    Delete
                                </button>
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleReplace}
                                    disabled={isReplacing}
                                    className="hidden"
                                    id="images-replace"
                                />
                                <label
                                    htmlFor="images-replace"
                                    className={`text-[12px] font-bold cursor-pointer hover:opacity-60 ${
                                        isReplacing ? 'cursor-wait opacity-40' : ''
                                    }`}
                                >
                                    {isReplacing ? 'Uploading…' : 'Replace'}
                                </label>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Reorder drawer — drag the stacked thumbnails to set the order images
                appear on the product display page (Figma 1952:193). */}
            {reorderOpen && (
                <div className="fixed inset-0 z-[60] bg-white flex flex-col">
                    <div className="flex items-center justify-center h-11 shrink-0 relative border-b border-black/10">
                        <span className="text-[12px] font-bold">Reorder Images</span>
                        <button
                            type="button"
                            onClick={() => setReorderOpen(false)}
                            aria-label="Close"
                            className="absolute right-4 text-[14px]"
                        >
                            ×
                        </button>
                    </div>

                    <Reorder.Group
                        axis="y"
                        values={reorderList}
                        onReorder={setReorderList}
                        className="flex-1 overflow-y-auto px-4 py-6 flex flex-col items-center gap-3"
                    >
                        {reorderList.map((img) => (
                            <Reorder.Item
                                key={img.url}
                                value={img}
                                className="relative aspect-[119/149] w-[119px] shrink-0 cursor-grab active:cursor-grabbing"
                                whileDrag={{ scale: 1.03, boxShadow: '0 4px 16px rgba(0,0,0,0.15)' }}
                            >
                                <Image src={img.url} alt="" fill sizes="119px" className="object-cover pointer-events-none" />
                            </Reorder.Item>
                        ))}
                    </Reorder.Group>

                    <div className="flex justify-end px-4 pb-6 pt-2 shrink-0">
                        <button
                            type="button"
                            onClick={confirmReorder}
                            className="text-[12px] font-bold px-2 py-1 bg-[#fdee9e]"
                        >
                            Confirm
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
