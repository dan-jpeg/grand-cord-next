'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useUploadThing } from '@/lib/uploadthing'
import { updateProductImages, type ImageRecord } from '@/app/admin/products/[id]/images/actions'

type ProductLite = { id: string; name: string; slug: string }

type RoleKey =
    | 'isGrid1x1Primary'
    | 'isGrid2x2Primary'
    | 'isGrid3x3Primary'
    | 'isMobilePrimary'
    | 'isDesktopPrimary'
    | 'isInventoryPrimary'

const CATALOG_TAGS: { key: RoleKey; shortcut: string; label: string }[] = [
    { key: 'isGrid1x1Primary', shortcut: '1', label: '1x1' },
    { key: 'isGrid2x2Primary', shortcut: '2', label: '2x2' },
    { key: 'isGrid3x3Primary', shortcut: '3', label: '3x3' },
    { key: 'isMobilePrimary', shortcut: 'm', label: 'mobile' },
    { key: 'isDesktopPrimary', shortcut: 'd', label: 'desktop' },
    { key: 'isInventoryPrimary', shortcut: 'i', label: 'inventory' },
]

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
    const [isUploading, setIsUploading] = useState(false)
    const [isReplacing, setIsReplacing] = useState(false)
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

    function setPdpVisible(visible: boolean) {
        persist(images.map((img, i) => (i === selectedIndex ? { ...img, showOnPdp: visible } : img)))
    }

    function removeSelected() {
        const next = withFallbackRoles(images.filter((_, i) => i !== selectedIndex))
        persist(next)
        setSelectedIndex((i) => Math.min(i, Math.max(next.length - 1, 0)))
    }

    return (
        <div className="absolute inset-0 bg-white font-alte flex flex-col">
            {/* Mobile header — right-aligned badge + tabs stacked vertically (matches Figma) */}
            <div className="md:hidden shrink-0 pt-3 pr-4 pl-14 flex justify-end">
                <div className="flex flex-col items-end gap-[5px]">
                    <Link
                        href={`/admin/products/${product.id}/edit`}
                        className="bg-neutral-200 px-1 text-[12px] font-bold"
                    >
                        {product.name}
                    </Link>
                    <Link
                        href={`/admin/products/${product.id}/edit?tab=identity`}
                        className="text-[12px] font-bold opacity-40"
                    >
                        Listing
                    </Link>
                    <Link
                        href={`/admin/products/${product.id}/edit?tab=sizing`}
                        className="text-[12px] font-bold opacity-40"
                    >
                        Inventory
                    </Link>
                    <span className="text-[12px] font-bold underline underline-offset-2">Images</span>
                </div>
            </div>

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
                            className="opacity-40 hover:opacity-70"
                        >
                            Listing
                        </Link>
                        <Link
                            href={`/admin/products/${product.id}/edit?tab=sizing`}
                            className="opacity-40 hover:opacity-70"
                        >
                            Inventory
                        </Link>
                        <span className="underline underline-offset-2">Images</span>
                    </nav>
                </div>
            </div>

            {/* Mobile grid — 2 columns, role dots overlaid on each cell */}
            <div className="md:hidden flex-1 overflow-y-auto px-4 pt-6 pb-8">
                {images.length === 0 ? (
                    <div className="w-full py-16 flex items-center justify-center text-[12px] text-neutral-400">
                        No images yet
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-x-3 gap-y-6">
                        {images.map((img, i) => {
                            const assigned = CATALOG_TAGS.filter(({ key }) => img[key])
                            return (
                                <button
                                    key={img.url + i}
                                    type="button"
                                    onClick={() => setSelectedIndex(i)}
                                    className="relative aspect-[171/245] bg-neutral-100"
                                >
                                    <Image src={img.url} alt="" fill className="object-contain" />
                                    {assigned.length > 0 && (
                                        <span className="absolute top-1 left-1/2 -translate-x-1/2 flex gap-1">
                                            {assigned.map(({ key, shortcut }) => (
                                                <RadioDot key={key} filled shortcut={shortcut} />
                                            ))}
                                        </span>
                                    )}
                                </button>
                            )
                        })}
                    </div>
                )}
            </div>

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
                                    className="relative aspect-[157/224] bg-neutral-100"
                                >
                                    <Image src={img.url} alt="" fill className="object-contain p-3" />
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
                    <div className="relative w-full h-full bg-neutral-100">
                        {selected?.url ? (
                            <Image src={selected.url} alt="" fill className="object-contain" priority />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-[12px] text-neutral-400">
                                No images yet
                            </div>
                        )}
                    </div>
                </div>

                {/* Controls */}
                <div className="w-[260px] shrink-0 flex flex-col overflow-y-auto pl-8 md:pl-4 pr-8 md:pr-4 py-8">
                    <div className="flex justify-end">
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
                            className={`bg-neutral-200/30 rounded-full px-3 py-1 text-[12px] font-bold cursor-pointer opacity-40 hover:opacity-70 ${
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
        </div>
    )
}
