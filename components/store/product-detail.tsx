'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useCart } from '@/contexts/cart-context'
import { formatPrice } from '@/lib/utils'
import type { Product, ProductSize } from '@prisma/client'

type ImageData = {
    url: string
    isMobilePrimary: boolean
    isDesktopPrimary: boolean
    isCartPrimary: boolean
}

type ProductWithSizes = Product & {
    sizes: ProductSize[]
}

const getSizeNumber = (size: string): number => {
    const sizeMap: Record<string, number> = {
        'XS': 0,
        'S': 1,
        'M': 2,
        'L': 3,
        'XL': 4,
        'XXL': 5,
    }
    return sizeMap[size] ?? 0
}

export function ProductDetail({ product }: { product: ProductWithSizes }) {
    const { addItem } = useCart()
    const [selectedSize, setSelectedSize] = useState<string>('')

    // Parse images from JSON
    const images = (product.images as any) as ImageData[]
    const displayImage = images.find(img => img.isDesktopPrimary)?.url || images[0]?.url
    const cartImage = images.find(img => img.isCartPrimary)?.url || images[0]?.url

    // Repeat image 4 times for scrolling
    const imageArray = displayImage ? [displayImage, displayImage, displayImage, displayImage] : []

    // Show ALL sizes, sorted, with availability info
    const allSizes = product.sizes.sort((a, b) => {
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
            image: cartImage,
            material: product.material || undefined,
            color: product.color || undefined,
        })

        alert('Added to cart!')
    }

    return (
        <div className="h-screen flex overflow-hidden">
            {/* Left Side - Fixed UI */}
            <div className="w-1/2 flex flex-col justify-between px-24 py-20 overflow-y-auto">
                {/* Header */}
                <div className="mb-3">
                    <Link href="/" className="inline-block mb-2">
                        <div className="text-[9pt]">
                            catalog / {product.name}
                        </div>
                    </Link>
                    <div className="border-t-2 border-black" />
                </div>

                {/* Two Column Layout: Description + Product Info */}
                <div className="flex-1 grid grid-cols-5 gap-8">
                    {/* Left Column - Description (3fr) */}
                    <div className="col-span-3 space-y-6 text-[9pt] leading-tight font-bold text-justify">
                        {product.description ? (
                            <div className="whitespace-pre-wrap">
                                {product.description}
                            </div>
                        ) : (
                            <>
                                <p>
                                    Lorem ipsum dolor sit amet consectetur adipiscing elit. Quisque faucibus ex sapien vitae pellentesque sem placerat. In id cursus mi pretium tellus duis convallis. Tempus leo eu aenean sed diam urna tempor. Pulvinar vivamus fringilla lacus nec metus bibendum egestas. Iaculis massa nisl malesuada lacinia integer nunc posuere. Ut hendrerit semper vel class aptent taciti sociosqu. Ad litora torquent per conubia nostra inceptos himenaeos.
                                </p>
                                <p>
                                    Lorem ipsum dolor sit amet consectetur adipiscing elit. Quisque faucibus ex sapien vitae pellentesque sem placerat. In id cursus mi pretium tellus duis convallis. Tempus leo eu aenean sed diam urna tempor.
                                </p>
                                <p>
                                    Lorem ipsum dolor sit amet consectetur adipiscing elit. Quisque faucibus ex sapien vitae pellentesque sem placerat. In id cursus mi pretium tellus duis convallis. Tempus leo eu aenean sed diam urna tempor. Pulvinar vivamus fringilla lacus nec metus bibendum egestas. Iaculis massa nisl malesuada lacinia integer nunc posuere. Ut hendrerit semper vel class aptent taciti sociosqu. Ad litora torquent per conubia nostra inceptos himenaeos. Iaculis massa nisl malesuada lacinia integer nunc posuere. Ut hendrerit semper vel class aptent taciti sociosqu. Ad litora torquent per conubia nostra inceptos himenaeos.
                                </p>
                            </>
                        )}
                    </div>

                    {/* Whitespace (1fr) */}
                    <div className="col-span-1" />

                    {/* Right Column - Product Info (1fr) */}
                    <div className="col-span-1 text-right space-y-1 text-[9pt]">
                        {product.material && product.color && (
                            <div>
                                <div className="lowercase">
                                    {product.material}
                                </div>
                                <div className="lowercase mb-20">
                                    {product.color}
                                </div>
                            </div>
                        )}
                        {product.designerName && (
                            <div className="mb-[210px]">{product.designerName}</div>
                        )}
                        <div className="font-bold">{formatPrice(product.price)}</div>
                    </div>
                </div>

                {/* Bottom Section - Size Selection & Add Button */}
                <div className="space-y-2 pt-8">
                    {/* Separator Line */}
                    <div className="border-t-2 border-black"/>
                    <div className="text-[9pt] uppercase tracking-wide">
                        SELECT SIZE
                    </div>
                    {/* Size Selection Row */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center justify-between mb-4 flex-1 ">
                            {allSizes.map((size) => {
                                const isAvailable = size.available > 0
                                const isSelected = selectedSize === size.size

                                return (
                                    <button
                                        key={size.id}
                                        onClick={() => isAvailable && setSelectedSize(size.size)}
                                        disabled={!isAvailable}
                                        className={`text-[11pt] transition-colors ${
                                            !isAvailable
                                                ? 'text-gray-400 cursor-not-allowed'
                                                : isSelected
                                                    ? 'font-bold underline'
                                                    : 'hover:underline'
                                        }`}
                                    >
                                        {getSizeNumber(size.size)}
                                    </button>
                                )
                            })}
                        </div>

                    </div>


                    {/* Size Guide & Add Button */}
                    <div className="flex items-center justify-between">
                        <button className="text-[9pt] italic underline hover:no-underline">
                            size guide
                        </button>
                        <button
                            onClick={handleAdd}
                            disabled={!selectedSize}
                            className="text-[11pt] uppercase font-bold hover:underline disabled:opacity-50 disabled:no-underline"
                        >
                            ADD
                        </button>
                    </div>
                </div>
            </div>

            {/* Right Side - Scrollable Images */}
            <div className="w-1/2 bg-neutral-100 overflow-y-auto">
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
        </div>
    )
}