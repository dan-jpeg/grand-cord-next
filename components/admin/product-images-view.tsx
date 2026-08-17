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

// Display order for the mobile detail view's design\ation row (Figma 1888:281).
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

// Desktop designation dots (Figma 2040:1458). Exported as 12px circles: filled
// is a solid r=6 disc, empty is a 1px-stroke r=5.5 ring. The PDP dot reuses the
// same geometry in green (#268339).
const DESIGNATION_GREEN = '#268339'

function DesignationDot({
    filled,
    size = 12,
    color = '#000000',
}: {
    filled: boolean
    size?: number
    color?: string
}) {
    return (
        <span
            className="relative block rounded-full shrink-0"
            style={{
                width: size,
                height: size,
                backgroundColor: filled ? color : 'transparent',
                border: filled ? 'none' : `1px solid ${color}`,
            }}
        >
            {/* Hovering an empty dot ghosts in the colour it would take, so you
                can tell black tag dots from the green PDP one before clicking. */}
            {!filled && (
                <span
                    aria-hidden
                    className="absolute inset-[1px] rounded-full opacity-0 transition-opacity duration-150 group-hover:opacity-30"
                    style={{ backgroundColor: color }}
                />
            )}
        </span>
    )
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
    // Desktop — Figma 2040:1458 (grid) / 2049:1620 (modal). Clicking a pill
    // image opens the modal in place; the grid stays visible on the left,
    // dimmed, so switching images doesn't require closing first.
    const [desktopModalOpen, setDesktopModalOpen] = useState(false)
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

    // Desktop grid view — each image has its own radio-dot column, so tags and
    // PDP visibility are set directly on that image rather than on `selected`.
    function setTagForImage(index: number, role: RoleKey) {
        persist(images.map((img, i) => ({ ...img, [role]: i === index })))
    }

    function togglePdpForImage(index: number) {
        persist(images.map((img, i) => (i === index ? { ...img, showOnPdp: !img.showOnPdp } : img)))
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
        // Deleting dismisses the preview rather than sliding the neighbouring
        // image into it — landing on an image you didn't pick reads like the
        // wrong one got deleted.
        setDesktopModalOpen(false)
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

            {/* Desktop header (Figma 2040:1458) — a single 35px row sharing the
                line with the global nav: tabs centred on the page, product badge
                at the far right, then the full-width rule the content hangs off. */}
            <div className="hidden md:block relative h-[44px] shrink-0">
                <nav className="flex justify-center gap-10 pt-[12px] text-[12px] font-bold">
                    <span className="underline underline-offset-2">Images</span>
                    <Link
                        href={`/admin/products/${product.id}/edit?tab=sizing`}
                        className="opacity-40 transition-opacity duration-150 hover:opacity-100"
                    >
                        Inventory
                    </Link>
                    <Link
                        href={`/admin/products/${product.id}/edit?tab=identity`}
                        className="opacity-40 transition-opacity duration-150 hover:opacity-100"
                    >
                        Listing
                    </Link>
                </nav>
                <Link
                    href={`/admin/products/${product.id}/edit`}
                    className="absolute right-[20px] top-[9px] bg-neutral-200 px-1 text-[12px] font-bold"
                >
                    {product.name}
                </Link>
            </div>

            <div className="hidden md:block h-px shrink-0 bg-black" />

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

            {/* Desktop — Figma 2040:1458 (images tab) / 2049:1620 (single-image
                modal). Geometry is taken straight off the 1512px frame: the
                strip starts 48px in, each group is a 12px dot column + 18px gap
                + a 156.8x224 pill, and groups repeat every 221.5px (35px apart).
                Opening the modal drops a 610x872 preview in at x=441, which
                clips the strip to that edge and dims what's still visible. */}
            <div
                className="hidden md:flex flex-1 min-h-0 overflow-hidden pt-[28px]"
                onClick={() => {
                    // Clicking anywhere outside the modal dismisses it. The modal's
                    // own subtree stops propagation, so only genuine outside clicks
                    // land here — including on the thumbnails, which therefore just
                    // close rather than swapping the previewed image straight over.
                    if (desktopModalOpen) setDesktopModalOpen(false)
                }}
            >
                {/* Thumbnail strip. Clipped to the modal's left edge while it's
                    open so the covered thumbnails fall away, exactly as the
                    preview occludes them in the Figma frame. */}
                <div
                    className={`shrink-0 overflow-hidden ${
                        desktopModalOpen ? 'w-[441px]' : 'flex-1 overflow-x-auto'
                    }`}
                >
                    <div
                        className={`flex items-start gap-[35px] pl-[48px] transition-opacity duration-150 ${
                            desktopModalOpen ? 'opacity-25' : ''
                        }`}
                    >
                        {images.map((img, i) => (
                            <div key={img.url + i} className="flex items-start gap-[18px] shrink-0">
                                {/* Designation column — the tag dots on a 14px
                                    pitch, then the green show-on-PDP dot. The
                                    frame only drew five; inventory is a real
                                    role too, so it rides along as a sixth. */}
                                <div className="flex flex-col items-start pt-[21px]">
                                    <div className="flex flex-col gap-[2px]">
                                        {CATALOG_TAGS.map(({ key, label }) => (
                                            <button
                                                key={key}
                                                type="button"
                                                disabled={pending}
                                                onClick={() => {
                                                    if (desktopModalOpen) return
                                                    setTagForImage(i, key)
                                                }}
                                                aria-label={label}
                                                title={label}
                                                className="group py-[1px]"
                                            >
                                                <DesignationDot filled={!!img[key]} />
                                            </button>
                                        ))}
                                    </div>
                                    <button
                                        type="button"
                                        disabled={pending}
                                        onClick={() => {
                                            if (desktopModalOpen) return
                                            togglePdpForImage(i)
                                        }}
                                        aria-label="Show on product page?"
                                        title="Show on product page?"
                                        className="group mt-[22px]"
                                    >
                                        <DesignationDot filled={img.showOnPdp} color={DESIGNATION_GREEN} />
                                    </button>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => {
                                        if (desktopModalOpen) return
                                        setSelectedIndex(i)
                                        setDesktopModalOpen(true)
                                    }}
                                    className="relative shrink-0 w-[156.8px] h-[224px] rounded-full overflow-hidden"
                                >
                                    <Image src={img.url} alt="" fill sizes="157px" className="object-cover" />
                                </button>
                            </div>
                        ))}
                    </div>

                    {/* Upload New + — centred under the strip (y=503 on the frame,
                        i.e. 216px below the pills). Hidden while the modal is up,
                        where the preview would cover it. */}
                    {!desktopModalOpen && (
                        <div className="flex items-center justify-center gap-[6px] pt-[216px]">
                            {images.length > 1 && (
                                <button
                                    type="button"
                                    onClick={openReorder}
                                    className="text-[12px] font-bold opacity-40 hover:opacity-70 mr-6"
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
                                className={`text-[12px] font-bold underline cursor-pointer hover:opacity-70 ${
                                    isUploading ? 'cursor-wait' : ''
                                }`}
                            >
                                {isUploading ? 'Uploading…' : 'Upload New'}
                            </label>
                            {/* Exported glyph rather than a "+" character, whose
                                optical centring drifts with the font. */}
                            <svg
                                aria-hidden
                                viewBox="0 0 13.3913 11"
                                className="w-[13.4px] h-[11px] shrink-0"
                            >
                                <rect width="13.3913" height="11" fill="#FDEE9E" />
                                {/* Scaled about the box centre so the glyph
                                    shrinks without moving off-centre. */}
                                <path
                                    transform="translate(6.6957 5.5) scale(0.8) translate(-6.6957 -5.5)"
                                    d="M7.76214 1.43479L6.10684 1.43479L6.10684 4.47762L2.86927 4.47762L2.86927 6.13291L6.10684 6.13291L6.10684 9.56522L7.76214 9.56522L7.76214 6.13291L10.9997 6.13291L10.9997 4.47762L7.76214 4.47762L7.76214 1.43479Z"
                                    fill="#2C2B2B"
                                />
                            </svg>
                        </div>
                    )}
                </div>

                {images.length === 0 && (
                    <div className="flex-1 flex items-center justify-center text-[12px] text-neutral-400">
                        No images yet
                    </div>
                )}

                {/* Modal — 610x872 preview with the designation column inset at
                    its top-left and the PDP toggle inside its bottom-right;
                    Notes / Replace / Delete sit in a column 23px to its right. */}
                {desktopModalOpen && selected && (
                    <div className="flex-1 min-w-0 flex" onClick={(e) => e.stopPropagation()}>
                        <div className="relative w-[610px] h-[872px] max-h-full shrink-0">
                            <Image src={selected.url} alt="" fill sizes="610px" className="object-cover" priority />

                            {/* Designations — dot, then its label directly below. */}
                            <div className="absolute left-[17px] top-[9px] z-10 flex flex-col items-start">
                                {CATALOG_TAGS.map(({ key, label }) => (
                                    <button
                                        key={key}
                                        type="button"
                                        disabled={pending}
                                        onClick={() => setTag(key)}
                                        className="group flex flex-col items-start"
                                    >
                                        <span className="h-[14px] flex items-center">
                                            <DesignationDot filled={!!selected[key]} />
                                        </span>
                                        <span className="text-[7.2pt] font-bold leading-normal">{label}</span>
                                    </button>
                                ))}
                            </div>

                            <button
                                type="button"
                                onClick={() => setDesktopModalOpen(false)}
                                aria-label="Close"
                                className="absolute right-[14px] top-[9px] z-10 text-[12px] font-bold leading-none opacity-60 hover:opacity-100"
                            >
                                ×
                            </button>

                            {/* show on product page? — inside the preview's bottom-right. */}
                            <button
                                type="button"
                                disabled={pending}
                                onClick={() => setPdpVisible(!selected.showOnPdp)}
                                className="group absolute right-[14px] bottom-[3px] z-10 flex items-center gap-[13px] text-[7.2pt] font-bold"
                            >
                                show on product page?
                                <DesignationDot filled={selected.showOnPdp} size={10} color={DESIGNATION_GREEN} />
                            </button>
                        </div>

                        {/* Right column — Notes above, Replace / Delete on the
                            preview's bottom line. */}
                        <div className="relative flex-1 min-w-0 pl-[23px]">
                            <div className="absolute left-[23px] right-4 bottom-[99px] flex flex-col">
                                <span className="text-[7.2pt] font-bold">Notes:</span>
                                <textarea
                                    value={selected.notes ?? ''}
                                    onChange={(e) =>
                                        setImages((prev) =>
                                            prev.map((img, i) =>
                                                i === selectedIndex ? { ...img, notes: e.target.value } : img,
                                            ),
                                        )
                                    }
                                    onBlur={() => persist(images)}
                                    placeholder="Add notes"
                                    rows={4}
                                    className="mt-[6px] w-full resize-none outline-none bg-transparent text-[7.2pt] font-bold leading-[1.6] placeholder:opacity-20"
                                />
                            </div>

                            <div className="absolute left-[23px] bottom-[3px] flex items-center gap-[70px]">
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
                                    className={`text-[7.2pt] font-bold cursor-pointer hover:opacity-60 ${
                                        isReplacing ? 'cursor-wait opacity-40' : ''
                                    }`}
                                >
                                    {isReplacing ? 'Uploading…' : 'Replace'}
                                </label>
                                <button
                                    type="button"
                                    disabled={pending}
                                    onClick={removeSelected}
                                    className="text-[7.2pt] font-bold px-[2.4px] py-[0.6px] bg-[rgba(255,197,197,0.4)] text-[red] hover:bg-[rgba(255,197,197,0.7)]"
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    </div>
                )}
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
