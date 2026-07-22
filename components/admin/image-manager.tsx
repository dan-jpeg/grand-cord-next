'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useUploadThing } from '@/lib/uploadthing'

export type ImageData = {
    url: string
    isMobilePrimary: boolean
    isDesktopPrimary: boolean
    isCartPrimary: boolean
    isGrid1x1Primary: boolean
    isGrid2x2Primary: boolean
    isGrid3x3Primary: boolean
    // Optional background-less inventory shot used in admin inventory views.
    isInventoryPrimary?: boolean
    showOnPdp: boolean
}

export function ImageManager({
    images,
    onChange,
}: {
    images: ImageData[]
    onChange: (images: ImageData[]) => void
}) {
    const [isUploading, setIsUploading] = useState(false)
    const { startUpload } = useUploadThing('productImage')

    async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
        const files = e.target.files
        if (!files || files.length === 0) return
        setIsUploading(true)
        try {
            const res = await startUpload(Array.from(files))
            if (res) {
                const newImages = res.map((file, index) => ({
                    url: file.url,
                    isMobilePrimary: images.length === 0 && index === 0,
                    isDesktopPrimary: images.length === 0 && index === 0,
                    isCartPrimary: images.length === 0 && index === 0,
                    isGrid1x1Primary: images.length === 0 && index === 0,
                    isGrid2x2Primary: images.length === 0 && index === 0,
                    isGrid3x3Primary: images.length === 0 && index === 0,
                    showOnPdp: true,
                }))
                onChange([...images, ...newImages])
            }
        } catch {
            alert('Upload failed')
        } finally {
            setIsUploading(false)
            // reset input so the same file can be re-uploaded
            e.target.value = ''
        }
    }

    function remove(index: number) {
        const updated = images.filter((_, i) => i !== index)
        if (updated.length > 0) {
            if (!updated.some((img) => img.isMobilePrimary)) updated[0].isMobilePrimary = true
            if (!updated.some((img) => img.isDesktopPrimary)) updated[0].isDesktopPrimary = true
            if (!updated.some((img) => img.isCartPrimary)) updated[0].isCartPrimary = true
            if (!updated.some((img) => img.isGrid1x1Primary)) updated[0].isGrid1x1Primary = true
            if (!updated.some((img) => img.isGrid2x2Primary)) updated[0].isGrid2x2Primary = true
            if (!updated.some((img) => img.isGrid3x3Primary)) updated[0].isGrid3x3Primary = true
        }
        onChange(updated)
    }

    function move(index: number, direction: -1 | 1) {
        const next = index + direction
        if (next < 0 || next >= images.length) return
        const updated = [...images]
        ;[updated[index], updated[next]] = [updated[next], updated[index]]
        onChange(updated)
    }

    return (
        <div>
            <div className="grid grid-cols-4 gap-4">
                {images.map((image, index) => (
                    <div key={image.url + index}>
                        {/* Image */}
                        <div className="relative aspect-[4/5] overflow-hidden">
                            <Image
                                src={image.url}
                                alt={`Product image ${index + 1}`}
                                fill
                                className="object-cover"
                            />
                        </div>

                        {/* Actions */}
                        <div className="mt-1.5 flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => move(index, -1)}
                                disabled={index === 0}
                                className="text-[7pt] text-neutral-300 hover:text-black disabled:opacity-20"
                            >
                                ←
                            </button>
                            <button
                                type="button"
                                onClick={() => move(index, 1)}
                                disabled={index === images.length - 1}
                                className="text-[7pt] text-neutral-300 hover:text-black disabled:opacity-20"
                            >
                                →
                            </button>
                            <button
                                type="button"
                                onClick={() => remove(index)}
                                className="ml-auto text-[7pt] font-bold uppercase text-neutral-300 hover:text-red-500 transition-colors"
                            >
                                Remove
                            </button>
                        </div>
                    </div>
                ))}

                {/* Upload slot */}
                <div>
                    <input
                        type="file"
                        multiple
                        accept="image/*"
                        onChange={handleFileChange}
                        disabled={isUploading}
                        className="hidden"
                        id="image-upload"
                    />
                    <label
                        htmlFor="image-upload"
                        className={`flex aspect-[4/5] items-center justify-center bg-neutral-100 text-[7pt] font-bold uppercase transition-colors ${
                            isUploading
                                ? 'text-neutral-400 cursor-wait'
                                : 'text-neutral-400 hover:bg-neutral-200 hover:text-black cursor-pointer'
                        }`}
                    >
                        {isUploading ? 'Uploading...' : '+ Add'}
                    </label>
                </div>
            </div>
        </div>
    )
}
