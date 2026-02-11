'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createProduct, updateProduct } from '@/app/admin/products/actions'
import { ImageManager, type ImageData } from '@/components/admin/image-manager'
import type { Product, ProductSize } from '@prisma/client'

type ProductWithSizes = Product & {
    sizes: ProductSize[]
    keywords?: string[]
}

const AVAILABLE_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL']
const MAX_DESIGNERS = 8

export function ProductForm({ product }: { product?: ProductWithSizes }) {
    const router = useRouter()
    const [isSubmitting, setIsSubmitting] = useState(false)

    // Form state
    const [name, setName] = useState(product?.name || '')
    const [slug, setSlug] = useState(product?.slug || '')
    const [description, setDescription] = useState(product?.description || '')
    const [keywordsInput, setKeywordsInput] = useState((product?.keywords || []).join(', '))
    const [designerNames, setDesignerNames] = useState<string[]>(
        product?.designerNames?.length ? product.designerNames : ['']
    )
    const [price, setPrice] = useState(product?.price || 0)
    const [published, setPublished] = useState(product?.published || false)

    // Parse existing images from JSON or create default structure
    const [images, setImages] = useState<ImageData[]>(() => {
        if (!product?.images) return []

        const rawImages = product.images as unknown

        // If it's already the new format
        if (Array.isArray(rawImages) && typeof rawImages[0] === 'object' && rawImages[0] !== null && 'url' in rawImages[0]) {
            return rawImages.map((img, index: number) => {
                const image = img as {
                    url?: string
                    isMobilePrimary?: boolean
                    isDesktopPrimary?: boolean
                    isCartPrimary?: boolean
                }

                return {
                    url: image.url || '',
                    isMobilePrimary: image.isMobilePrimary ?? (index === 0),
                    isDesktopPrimary: image.isDesktopPrimary ?? (index === 0),
                    isCartPrimary: image.isCartPrimary ?? (index === 0),
                }
            })
        }

        // If it's old format (string array), convert
        if (Array.isArray(rawImages)) {
            return rawImages.map((url: string, index: number) => ({
                url,
                isMobilePrimary: index === 0,
                isDesktopPrimary: index === 0,
                isCartPrimary: index === 0, // Add this
            }))
        }

        return []
    })

    const [material, setMaterial] = useState(product?.material || '')
    const [color, setColor] = useState(product?.color || '')
    const [colorHex, setColorHex] = useState(product?.colorHex || '')

    // Sizes state
    // In the sizes state definition
    // Sizes state
    const [sizes, setSizes] = useState<{
        size: string
        available: number
    }[]>(
        product?.sizes.length
            ? product.sizes.map((s) => ({
                size: s.size,
                available: s.available
            }))
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
        if (availableSize) {
            setSizes([...sizes, { size: availableSize, available: 0 }])
        }
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
        if (designerNames.length === 1) {
            setDesignerNames([''])
            return
        }
        setDesignerNames(designerNames.filter((_, i) => i !== index))
    }



    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setIsSubmitting(true)

        const data = {
            name,
            slug: slug || undefined,
            description: description || undefined,
            keywords: keywordsInput
                .split(/[,\n]/)
                .map((keyword: string) => keyword.trim())
                .filter(Boolean),
            designerNames: designerNames.map((name) => name.trim()).filter(Boolean).slice(0, MAX_DESIGNERS),
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
        <form onSubmit={handleSubmit} className="space-y-8">
            <div className="bg-white border border-neutral-200 p-6 space-y-6">
                {/* ... all your other form fields stay the same ... */}
                <div>
                    <label htmlFor="name" className="block text-sm font-medium mb-2">
                        Product Name *
                    </label>
                    <input
                        id="name"
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full px-4 py-3 border border-neutral-300 focus:outline-none focus:border-black"
                        required
                    />
                </div>

                <div>
                    <label htmlFor="slug" className="block text-sm font-medium mb-2">
                        Slug
                    </label>
                    <input
                        id="slug"
                        type="text"
                        value={slug}
                        onChange={(e) => setSlug(e.target.value)}
                        placeholder="auto-generated-from-name"
                        className="w-full px-4 py-3 border border-neutral-300 focus:outline-none focus:border-black"
                    />
                    <p className="text-xs text-neutral-600 mt-1">
                        Leave blank to auto-generate from product name
                    </p>
                </div>

                <div>
                    <label htmlFor="keywords" className="block text-sm font-medium mb-2">
                        Keywords
                    </label>
                    <textarea
                        id="keywords"
                        value={keywordsInput}
                        onChange={(e) => setKeywordsInput(e.target.value)}
                        rows={3}
                        placeholder="e.g. oversized, winter, outerwear, cotton"
                        className="w-full px-4 py-3 border border-neutral-300 focus:outline-none focus:border-black"
                    />
                    <p className="text-xs text-neutral-600 mt-1">
                        Comma-separated search keywords used in both store and admin product search.
                    </p>
                </div>

                <div>
                    <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm font-medium">
                            Designers
                        </label>
                        <button
                            type="button"
                            onClick={addDesigner}
                            disabled={designerNames.length >= MAX_DESIGNERS}
                            className="text-sm underline hover:no-underline disabled:opacity-50"
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
                                    className="w-full px-4 py-3 border border-neutral-300 focus:outline-none focus:border-black"
                                    placeholder={`Designer ${index + 1}`}
                                />
                                <button
                                    type="button"
                                    onClick={() => removeDesigner(index)}
                                    disabled={designerNames.length === 1}
                                    className="text-sm text-red-600 underline hover:no-underline disabled:opacity-50"
                                >
                                    Remove
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
                <div>
                    <label htmlFor="material" className="block text-sm font-medium mb-2">
                        Material
                    </label>
                    <input
                        id="material"
                        type="text"
                        value={material}
                        onChange={(e) => setMaterial(e.target.value)}
                        placeholder="e.g. Cotton, Wool, Polyester"
                        className="w-full px-4 py-3 border border-neutral-300 focus:outline-none focus:border-black"
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="color" className="block text-sm font-medium mb-2">
                            Color Name
                        </label>
                        <input
                            id="color"
                            type="text"
                            value={color}
                            onChange={(e) => setColor(e.target.value)}
                            placeholder="e.g. Black, Navy, Olive"
                            className="w-full px-4 py-3 border border-neutral-300 focus:outline-none focus:border-black"
                        />
                    </div>

                    <div>
                        <label htmlFor="colorHex" className="block text-sm font-medium mb-2">
                            Color Hex
                        </label>
                        <input
                            id="colorHex"
                            type="text"
                            value={colorHex}
                            onChange={(e) => setColorHex(e.target.value)}
                            placeholder="#000000"
                            className="w-full px-4 py-3 border border-neutral-300 focus:outline-none focus:border-black"
                        />
                    </div>
                </div>


                <div>
                    <label htmlFor="description" className="block text-sm font-medium mb-2">
                        Description
                    </label>
                    <textarea
                        id="description"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        rows={4}
                        className="w-full px-4 py-3 border border-neutral-300 focus:outline-none focus:border-black"
                    />
                </div>

                <div>
                    <label htmlFor="price" className="block text-sm font-medium mb-2">
                        Price (USD) *
                    </label>
                    <input
                        id="price"
                        type="number"
                        step="0.01"
                        min="0"
                        value={price}
                        onChange={(e) => setPrice(Number(e.target.value))}
                        className="w-full px-4 py-3 border border-neutral-300 focus:outline-none focus:border-black"
                        required
                    />
                </div>
            </div>

            {/* Images Section */}
            <div className="bg-white border border-neutral-200 p-6">
                <h3 className="font-medium mb-4">Product Images</h3>
                <ImageManager images={images} onChange={setImages}/>
            </div>

            {/* Sizes Section */}
            <div className="bg-white border border-neutral-200 p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-medium">Inventory by Size</h3>
                    <button
                        type="button"
                        onClick={addSize}
                        disabled={sizes.length >= AVAILABLE_SIZES.length}
                        className="text-sm underline hover:no-underline disabled:opacity-50"
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
                                className="px-4 py-3 border border-neutral-300 focus:outline-none focus:border-black"
                            >
                                {AVAILABLE_SIZES.map((size) => (
                                    <option key={size} value={size}>{size}</option>
                                ))}
                            </select>

                            <div className="flex-1">
                                <label className="block text-xs mb-1">Available</label>
                                <input
                                    type="number"
                                    min="0"
                                    value={sizeItem.available}
                                    onChange={(e) => updateSize(index, 'available', Number(e.target.value))}
                                    className="w-full px-4 py-3 border border-neutral-300 focus:outline-none focus:border-black"
                                />
                            </div>

                            <button
                                type="button"
                                onClick={() => removeSize(index)}
                                disabled={sizes.length === 1}
                                className="text-sm text-red-600 underline hover:no-underline disabled:opacity-50"
                            >
                                Remove
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {/* Publishing */}
            <div className="bg-white border border-neutral-200 p-6">
                <label className="flex items-center gap-3">
                    <input
                        type="checkbox"
                        checked={published}
                        onChange={(e) => setPublished(e.target.checked)}
                        className="w-4 h-4"
                    />
                    <span className="text-sm font-medium">Published (visible on store)</span>
                </label>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-4">
                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="bg-black text-white px-8 py-3 font-medium hover:bg-neutral-800 disabled:opacity-50 transition-colors"
                >
                    {isSubmitting ? 'Saving...' : product ? 'Update Product' : 'Create Product'}
                </button>
                <button
                    type="button"
                    onClick={() => router.back()}
                    className="px-8 py-3 font-medium hover:underline"
                >
                    Cancel
                </button>
            </div>
        </form>
    )
}
