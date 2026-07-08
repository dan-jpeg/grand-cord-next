'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import { useUploadThing } from '@/lib/uploadthing'
import { updateProductImages, type ImageRecord } from '@/app/admin/products/[id]/images/actions'

type ProductLite = { id: string; name: string; slug: string }

type RoleKey =
    | 'isGrid1x1Primary'
    | 'isGrid2x2Primary'
    | 'isGrid3x3Primary'
    | 'isMobilePrimary'
    | 'isDesktopPrimary'

const CATALOG_TAGS: { key: RoleKey; label: string }[] = [
    { key: 'isGrid1x1Primary', label: '1x1' },
    { key: 'isGrid2x2Primary', label: '2x2' },
    { key: 'isGrid3x3Primary', label: '3x3' },
    { key: 'isMobilePrimary', label: 'mobile' },
    { key: 'isDesktopPrimary', label: 'desktop' },
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
    const [showMaybe, setShowMaybe] = useState(true)
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
            {/* Header row — product badge, level with the admin nav */}
            <div className="h-10 shrink-0 flex items-center justify-end pr-8 md:pr-4">
                <Link
                    href={`/admin/products/${product.id}/edit`}
                    className="bg-neutral-200 px-1 text-[12px] font-bold"
                >
                    {product.name}
                </Link>
            </div>

            {/* Divider under the nav / header row */}
            <div className="h-px shrink-0 bg-black" />

            <div className="flex-1 flex overflow-hidden">
                {/* Big preview — fills the left side, full height, flush with the edge */}
                <div className="h-full flex-[1.3] shrink-0 pt-4 pb-4 pl-4">
                    <div className="relative w-full h-full">
                        {selected?.url ? (
                            <Image src={selected.url} alt="" fill className="object-contain object-left" priority />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-[12px] text-neutral-400">
                                No images yet
                            </div>
                        )}
                    </div>
                </div>

                {/* Controls — right-aligned so it lines up under the product badge */}
                <div className="flex-1 min-w-[320px] overflow-y-auto pl-8 md:pl-16 pr-8 md:pr-4 py-8">
                    <div className="flex justify-end mb-2">
                        <span className="text-[12px] font-bold underline underline-offset-2">Images</span>
                    </div>

                    {/* Thumbnails — right-aligned, grow outward toward the left */}
                    <div className="flex flex-wrap gap-1.5 mb-2 justify-end">
                        {images.map((img, i) => (
                            <button
                                key={img.url + i}
                                type="button"
                                onClick={() => setSelectedIndex(i)}
                                className={`relative w-10 h-12 shrink-0 bg-neutral-100 overflow-hidden border transition-opacity ${
                                    i === selectedIndex
                                        ? 'border-black'
                                        : 'border-transparent opacity-40 hover:opacity-100'
                                }`}
                            >
                                <Image src={img.url} alt="" fill className="object-cover" />
                            </button>
                        ))}
                    </div>
                    <div className="flex justify-end mb-32">
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
                            {isUploading ? 'Uploading…' : 'Upload New ↖'}
                        </label>
                    </div>

                    {selected && (
                        <>
                            {/* Show on PDP / catalog tags */}
                            <div className="grid grid-cols-[auto_1fr] gap-x-10 gap-y-4 text-[12px] font-bold mb-32">
                                <span className="whitespace-nowrap">Show on product display page:</span>
                                <div className="flex gap-8 justify-end">
                                    <motion.button
                                        layout
                                        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                                        type="button"
                                        disabled={pending}
                                        onClick={() => setPdpVisible(true)}
                                        className={selected.showOnPdp ? '' : 'opacity-20'}
                                    >
                                        Yes
                                    </motion.button>
                                    <motion.button
                                        layout
                                        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                                        type="button"
                                        disabled={pending}
                                        onClick={() => setPdpVisible(false)}
                                        className={!selected.showOnPdp ? '' : 'opacity-20'}
                                    >
                                        No
                                    </motion.button>
                                    <AnimatePresence>
                                        {showMaybe && (
                                            <motion.button
                                                layout
                                                initial={false}
                                                exit={{ opacity: 0, scale: 0.5 }}
                                                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                                                type="button"
                                                onClick={() => setShowMaybe(false)}
                                                className="opacity-20 hover:opacity-60"
                                            >
                                                Maybe
                                            </motion.button>
                                        )}
                                    </AnimatePresence>
                                </div>

                                <span className="whitespace-nowrap">Use on catalog:</span>
                                <div className="flex gap-8 justify-end">
                                    {CATALOG_TAGS.map(({ key, label }) => (
                                        <button
                                            key={key}
                                            type="button"
                                            disabled={pending}
                                            onClick={() => setTag(key)}
                                            className={selected[key] ? '' : 'opacity-20'}
                                        >
                                            {label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Delete / Replace */}
                            <div className="flex items-center justify-end gap-6">
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
