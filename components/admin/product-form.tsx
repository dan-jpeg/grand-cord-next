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

const inputClass =
    'w-full px-4 py-3 bg-neutral-100 rounded-lg text-sm focus:outline-none focus:bg-neutral-200 transition-colors placeholder:text-neutral-400'

const labelClass = 'block text-sm font-bold mb-2'

export function ProductForm({ product }: { product?: ProductWithSizes }) {
    const router = useRouter()
    const [isSubmitting, setIsSubmitting] = useState(false)

    const [name, setName] = useState(product?.name || '')
    const [slug, setSlug] = useState(product?.slug || '')
    const [description, setDescription] = useState(product?.description || '')
    const [keywordsInput, setKeywordsInput] = useState((product?.keywords || []).join(', '))
    const [designerNames, setDesignerNames] = useState<string[]>(
        product?.designerNames?.length ? product.designerNames : ['']
    )
    const [price, setPrice] = useState(product?.price || 0)
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

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
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
        <form onSubmit={handleSubmit} className="space-y-8">

            {/* Product Information */}
            <div className="space-y-1 pb-2">
                <p className="text-sm font-bold">Product Information:</p>
            </div>

            <div className="space-y-5">
                <div>
                    <label htmlFor="name" className={labelClass}>Name:</label>
                    <input
                        id="name"
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className={inputClass}
                        required
                    />
                </div>

                <div>
                    <label htmlFor="slug" className={labelClass}>Slug:</label>
                    <input
                        id="slug"
                        type="text"
                        value={slug}
                        onChange={(e) => setSlug(e.target.value)}
                        placeholder="auto-generated-from-name"
                        className={inputClass}
                    />
                    <p className="text-xs text-neutral-500 mt-1.5">Leave blank to auto-generate from product name</p>
                </div>

                <div>
                    <label htmlFor="price" className={labelClass}>Price (USD):</label>
                    <input
                        id="price"
                        type="number"
                        step="0.01"
                        min="0"
                        value={price}
                        onChange={(e) => setPrice(Number(e.target.value))}
                        className={inputClass}
                        required
                    />
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
            </div>

            {/* Details */}
            <div className="space-y-5 pt-2 border-t border-neutral-100">
                <p className="text-sm font-bold pt-4">Details:</p>

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
            </div>

            {/* Designers */}
            <div className="space-y-4 pt-2 border-t border-neutral-100">
                <div className="flex items-center justify-between pt-4">
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

            {/* Images */}
            <div className="pt-2 border-t border-neutral-100">
                <p className="text-sm font-bold pt-4 mb-4">Product Images:</p>
                <ImageManager images={images} onChange={setImages} />
            </div>

            {/* Inventory by Size */}
            <div className="space-y-4 pt-2 border-t border-neutral-100">
                <div className="flex items-center justify-between pt-4">
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

            {/* Publishing + Actions */}
            <div className="pt-4 border-t border-neutral-100 flex items-center justify-between">
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

                <div className="flex items-center gap-6">
                    <button
                        type="button"
                        onClick={() => router.back()}
                        className="text-sm text-neutral-400 hover:text-black underline hover:no-underline"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="text-sm font-bold underline hover:no-underline disabled:opacity-40"
                    >
                        {isSubmitting ? 'Saving...' : product ? 'Update Product' : 'Create Product'}
                    </button>
                </div>
            </div>

        </form>
    )
}
