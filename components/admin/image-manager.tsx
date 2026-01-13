'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useUploadThing } from '@/lib/uploadthing'

export type ImageData = {
    url: string
    isMobilePrimary: boolean
    isDesktopPrimary: boolean
    isCartPrimary: boolean
}

export function ImageManager({
                                 images,
                                 onChange,
                             }: {
    images: ImageData[]
    onChange: (images: ImageData[]) => void
}) {
    const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
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
                    // First image uploaded (and first overall) is mobile, desktop, and cart primary
                    isMobilePrimary: images.length === 0 && index === 0,
                    isDesktopPrimary: images.length === 0 && index === 0,
                    isCartPrimary: images.length === 0 && index === 0,
                }))
                onChange([...images, ...newImages])
            }
        } catch (error) {
            alert('Upload failed')
        } finally {
            setIsUploading(false)
        }
    }

    function toggleMobilePrimary() {
        if (selectedIndex === null) return
        const updated = [...images]
        updated.forEach(img => img.isMobilePrimary = false)
        updated[selectedIndex].isMobilePrimary = true
        onChange(updated)
    }

    function toggleDesktopPrimary() {
        if (selectedIndex === null) return
        const updated = [...images]
        updated.forEach(img => img.isDesktopPrimary = false)
        updated[selectedIndex].isDesktopPrimary = true
        onChange(updated)
    }

    function toggleCartPrimary() {
        if (selectedIndex === null) return
        const updated = [...images]
        updated.forEach(img => img.isCartPrimary = false)
        updated[selectedIndex].isCartPrimary = true
        onChange(updated)
    }

    function removeImage() {
        if (selectedIndex === null) return
        const updated = images.filter((_, i) => i !== selectedIndex)

        if (updated.length > 0) {
            const hasMobilePrimary = updated.some(img => img.isMobilePrimary)
            const hasDesktopPrimary = updated.some(img => img.isDesktopPrimary)
            const hasCartPrimary = updated.some(img => img.isCartPrimary)

            if (!hasMobilePrimary) updated[0].isMobilePrimary = true
            if (!hasDesktopPrimary) updated[0].isDesktopPrimary = true
            if (!hasCartPrimary) updated[0].isCartPrimary = true
        }

        onChange(updated)
        setSelectedIndex(null)
    }

    return (
        <div className="space-y-4">
            {/* Upload Area */}
            <div className="border-2 border-black p-8 text-center">
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
                    className={`cursor-pointer text-sm font-bold uppercase ${
                        isUploading ? 'opacity-50' : 'hover:underline'
                    }`}
                >
                    {isUploading ? 'Uploading...' : 'Upload Images'}
                </label>
            </div>

            {images.length > 0 && (
                <div className="flex gap-6">
                    {/* Image Grid */}
                    <div className="flex-1">
                        <div className="grid grid-cols-4 gap-3">
                            {images.map((image, index) => (
                                <button
                                    type="button"
                                    key={index}
                                    onClick={() => setSelectedIndex(index)}
                                    className={`relative aspect-square border-2 transition-all ${
                                        selectedIndex === index
                                            ? 'border-black shadow-lg scale-105'
                                            : 'border-neutral-300 hover:border-neutral-500'
                                    }`}
                                >
                                    <Image
                                        src={image.url}
                                        alt={`Product ${index + 1}`}
                                        fill
                                        className="object-cover"
                                    />

                                    {/* Indicators */}
                                    <div className="absolute top-1 right-1 flex gap-1">
                                        {image.isMobilePrimary && (
                                            <div className="bg-black text-white px-1 text-[8px] font-bold">
                                                M
                                            </div>
                                        )}
                                        {image.isDesktopPrimary && (
                                            <div className="bg-black text-white px-1 text-[8px] font-bold">
                                                D
                                            </div>
                                        )}
                                        {image.isCartPrimary && (
                                            <div className="bg-black text-white px-1 text-[8px] font-bold">
                                                C
                                            </div>
                                        )}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Controls */}
                    {selectedIndex !== null && (
                        <div className="w-48 border border-black p-4 space-y-3">
                            <div className="text-sm font-bold mb-4">
                                Image {selectedIndex + 1}
                            </div>

                            <button
                                type="button"
                                onClick={toggleMobilePrimary}
                                className={`w-full flex items-center gap-3 p-3 border transition-colors ${
                                    images[selectedIndex].isMobilePrimary
                                        ? 'border-black bg-black text-white'
                                        : 'border-neutral-300 hover:bg-neutral-100'
                                }`}
                            >
                                <div className="w-2 h-8 bg-current" />
                                <span className="text-xs font-bold uppercase">Mobile Primary</span>
                            </button>

                            <button
                                type="button"
                                onClick={toggleDesktopPrimary}
                                className={`w-full flex items-center gap-3 p-3 border transition-colors ${
                                    images[selectedIndex].isDesktopPrimary
                                        ? 'border-black bg-black text-white'
                                        : 'border-neutral-300 hover:bg-neutral-100'
                                }`}
                            >
                                <div className="flex gap-1">
                                    <div className="w-2 h-8 bg-current" />
                                    <div className="w-2 h-8 bg-current" />
                                    <div className="w-2 h-8 bg-current" />
                                </div>
                                <span className="text-xs font-bold uppercase">Desktop Primary</span>
                            </button>

                            <button
                                type="button"
                                onClick={toggleCartPrimary}
                                className={`w-full flex items-center gap-3 p-3 border transition-colors ${
                                    images[selectedIndex].isCartPrimary
                                        ? 'border-black bg-black text-white'
                                        : 'border-neutral-300 hover:bg-neutral-100'
                                }`}
                            >
                                <div className="w-6 h-6 border-2 border-current" />
                                <span className="text-xs font-bold uppercase">Cart Primary</span>
                            </button>

                            <button
                                type="button"
                                onClick={removeImage}
                                className="w-full p-3 border border-red-600 text-red-600 text-xs font-bold uppercase hover:bg-red-50 transition-colors"
                            >
                                Remove
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}