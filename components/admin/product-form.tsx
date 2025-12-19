'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createProduct, updateProduct } from '@/app/admin/products/actions'
import { UploadDropzone } from '@/lib/uploadthing'
import type { Product, ProductSize } from '@prisma/client'
import Image from 'next/image'

type ProductWithSizes = Product & {
    sizes: ProductSize[]
}

const AVAILABLE_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL']

export function ProductForm({ product }: { product?: ProductWithSizes }) {
    const router = useRouter()
    const [isSubmitting, setIsSubmitting] = useState(false)

    // Form state
    const [name, setName] = useState(product?.name || '')
    const [slug, setSlug] = useState(product?.slug || '')
    const [description, setDescription] = useState(product?.description || '')
    const [designerName, setDesignerName] = useState(product?.designerName || '')
    const [price, setPrice] = useState(product?.price || 0)
    const [published, setPublished] = useState(product?.published || false)
    const [images, setImages] = useState<string[]>(product?.images || [])

    const [material, setMaterial] = useState(product?.material || '')
    const [color, setColor] = useState(product?.color || '')
    const [colorHex, setColorHex] = useState(product?.colorHex || '')

    // Sizes state
    const [sizes, setSizes] = useState<{ size: string; stock: number }[]>(
        product?.sizes.length
            ? product.sizes.map((s) => ({ size: s.size, stock: s.stock }))
            : [{ size: 'M', stock: 0 }]
    )

    function addSize() {
        const usedSizes = sizes.map((s) => s.size)
        const availableSize = AVAILABLE_SIZES.find((s) => !usedSizes.includes(s))
        if (availableSize) {
            setSizes([...sizes, { size: availableSize, stock: 0 }])
        }
    }

    function removeSize(index: number) {
        setSizes(sizes.filter((_, i) => i !== index))
    }

    function updateSize(index: number, field: 'size' | 'stock', value: string | number) {
        const newSizes = [...sizes]
        newSizes[index] = { ...newSizes[index], [field]: value }
        setSizes(newSizes)
    }

    function removeImage(index: number) {
        setImages(images.filter((_, i) => i !== index))
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setIsSubmitting(true)

        const data = {
            name,
            slug: slug || undefined,
            description: description || undefined,
            designerName: designerName || undefined,
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

        // Don't set isSubmitting to false - redirect will happen
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-8">
            <div className="bg-white border border-neutral-200 p-6 space-y-6">
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
                    <label htmlFor="designerName" className="block text-sm font-medium mb-2">
                        Designer Name
                    </label>
                    <input
                        id="designerName"
                        type="text"
                        value={designerName}
                        onChange={(e) => setDesignerName(e.target.value)}
                        className="w-full px-4 py-3 border border-neutral-300 focus:outline-none focus:border-black"
                    />
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

                {images.length > 0 && (
                    <div className="grid grid-cols-4 gap-4 mb-4">
                        {images.map((url, index) => (
                            <div key={index} className="relative aspect-square border border-neutral-200">
                                <Image
                                    src={url}
                                    alt={`Product ${index + 1}`}
                                    fill
                                    className="object-cover"
                                />
                                <button
                                    type="button"
                                    onClick={() => removeImage(index)}
                                    className="absolute top-2 right-2 bg-red-600 text-white w-6 h-6 flex items-center justify-center text-sm hover:bg-red-700"
                                >
                                    ×
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                <UploadDropzone
                    endpoint="productImage"
                    onClientUploadComplete={(res) => {
                        const newUrls = res.map((file) => file.url)
                        setImages([...images, ...newUrls])
                    }}
                    onUploadError={(error: Error) => {
                        alert(`Upload error: ${error.message}`)
                    }}
                />
            </div>

            {/* Sizes Section */}
            <div className="bg-white border border-neutral-200 p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-medium">Sizes & Stock</h3>
                    <button
                        type="button"
                        onClick={addSize}
                        disabled={sizes.length >= AVAILABLE_SIZES.length}
                        className="text-sm underline hover:no-underline disabled:opacity-50 disabled:no-underline"
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
                                    <option key={size} value={size}>
                                        {size}
                                    </option>
                                ))}
                            </select>

                            <input
                                type="number"
                                min="0"
                                value={sizeItem.stock}
                                onChange={(e) => updateSize(index, 'stock', Number(e.target.value))}
                                placeholder="Stock"
                                className="flex-1 px-4 py-3 border border-neutral-300 focus:outline-none focus:border-black"
                            />

                            <button
                                type="button"
                                onClick={() => removeSize(index)}
                                disabled={sizes.length === 1}
                                className="text-sm text-red-600 underline hover:no-underline disabled:opacity-50 disabled:no-underline"
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