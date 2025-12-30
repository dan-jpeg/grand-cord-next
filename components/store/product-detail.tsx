'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useCart } from '@/contexts/cart-context'
import type { Product, ProductSize } from '@prisma/client'

type ImageData = {
    url: string
    isMobilePrimary: boolean
    isDesktopPrimary: boolean
}

type ProductWithSizes = Product & {
    sizes: ProductSize[]
}

export function ProductDetail({ product }: { product: ProductWithSizes }) {
    const { addItem } = useCart()
    const [selectedSize, setSelectedSize] = useState<string>('')

    // Parse images from JSON
    const images = (product.images as any) as ImageData[]
    const displayImage = images.find(img => img.isDesktopPrimary)?.url || images[0]?.url

    // Repeat first image 4 times for testing
    const imageArray = displayImage ? [displayImage, displayImage, displayImage, displayImage] : []

    const availableSizes = product.sizes
        .filter(s => s.available > 0)
        .sort((a, b) => {
            const order = ['XS', 'S', 'M', 'L', 'XL', 'XXL']
            return order.indexOf(a.size) - order.indexOf(b.size)
        })

    function handleAdd() {
        if (!selectedSize) {
            alert('Please select a size')
            return
        }

        addItem({
            productId: product.id,
            productName: product.name,
            productSlug: product.slug,
            size: selectedSize,
            price: product.price,
            image: displayImage,
        })

        alert('Added to cart!')
    }

    return (
        <div className="min-h-screen bg-white flex">
            {/* Left Column - Images (Scrollable) */}
            <div className="w-1/2 overflow-y-auto">
                <div className="space-y-0">
                    {imageArray.map((img, index) => (
                        <div key={index} className="w-full">
                            <Image
                                src={img}
                                alt={`${product.name} ${index + 1}`}
                                width={3587}
                                height={4400}
                                className="w-full h-auto"
                                priority={index === 0}
                            />
                        </div>
                    ))}
                </div>
            </div>

            {/* Right Column - Fixed Info */}
            <div className="w-1/2 h-screen sticky top-0 flex">
                {/* Left Side - Product Details */}
                <div className="w-1/2 p-8 flex flex-col justify-between border-l border-black">
                    <div>
                        <div className="mb-8">
                            <h1 className="text-sm font-bold mb-1">{product.name}</h1>
                            {product.designerName && (
                                <p className="text-sm">{product.designerName}</p>
                            )}
                        </div>

                        <div className="border-t border-black pt-4">
                            <div className="space-y-1 text-sm">
                                {product.color && <div>{product.color}</div>}
                                <div>{product.price} USD</div>
                                {product.material && <div>{product.material}</div>}
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={handleAdd}
                        disabled={!selectedSize}
                        className="w-full bg-black text-white py-3 text-sm font-bold uppercase hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        ADD TO CART
                    </button>
                </div>

                {/* Right Side - Size Picker */}
                <div className="w-1/2 p-8 border-l border-black">
                    <div className="flex justify-between items-start mb-6">
                        <h2 className="text-sm font-bold uppercase">Select Size</h2>
                        <button className="text-sm">?</button>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                        {availableSizes.map((size, index) => (
                            <button
                                key={size.id}
                                onClick={() => setSelectedSize(size.size)}
                                className={`aspect-square flex items-center justify-center border-2 border-black text-sm font-bold transition-colors ${
                                    selectedSize === size.size
                                        ? 'bg-black text-white'
                                        : 'bg-white text-black hover:bg-neutral-100'
                                }`}
                            >
                                {index + 1}
                            </button>
                        ))}
                    </div>

                    <div className="mt-4 text-xs text-neutral-600">
                        {selectedSize && `Selected: ${selectedSize}`}
                    </div>
                </div>
            </div>
        </div>
    )
}