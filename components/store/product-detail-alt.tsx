'use client'

import { useState, useRef, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useCart } from '@/contexts/cart-context'
import { formatPrice } from '@/lib/utils'
import { formatDesignerNames } from '@/lib/designers'
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
        XS: 0,
        S: 1,
        M: 2,
        L: 3,
        XL: 4,
        XXL: 5,
    }
    return sizeMap[size] ?? 0
}

export function ProductDetailAlt({ product }: { product: ProductWithSizes }) {
    const { addItem } = useCart()
    const [selectedSize, setSelectedSize] = useState<string>('')
    const scrollContainerRef = useRef<HTMLDivElement>(null)

    const images = product.images as ImageData[]
    const designerLabel = formatDesignerNames(product.designerNames)
    const displayImage =
        images.find(img => img.isDesktopPrimary)?.url || images[0]?.url
    const cartImage =
        images.find(img => img.isCartPrimary)?.url || images[0]?.url

    const imageArray = displayImage
        ? [displayImage, displayImage, displayImage, displayImage]
        : []

    const allSizes = [...product.sizes].sort((a, b) => {
        const order = ['XS', 'S', 'M', 'L', 'XL', 'XXL']
        return order.indexOf(a.size) - order.indexOf(b.size)
    })

    useEffect(() => {
        const handleWheel = (e: WheelEvent) => {
            if (!scrollContainerRef.current) return
            e.preventDefault()
            scrollContainerRef.current.scrollTop += e.deltaY
        }

        window.addEventListener('wheel', handleWheel, { passive: false })
        return () => window.removeEventListener('wheel', handleWheel)
    }, [])

    function handleAdd() {
        if (!selectedSize) return

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

        setTimeout(() => setSelectedSize(''), 1200)
    }

    return (
        <div className="h-screen overflow-hidden bg-white flex justify-center">
            <div className="h-screen overflow-hidden relative bg-white w-full max-w-[1512px]">
                {/* Left Side - Absolutely Positioned Text Content */}
                <div
                    className="absolute left-0 top-0 h-screen w-[45%] z-50 flex flex-col justify-between pointer-events-none">
                    <div className="pl-24 pt-32 pb-12 pointer-events-auto">
                        {/* Header */}
                        <div className="mb-8">
                            <Link href="/#catalog" className="inline-block mb-2">
                                <div className="text-[14pt] opacity-20 hover:opacity-90 font-bold tracking-tight">
                                    catalog / {product.name}
                                </div>
                            </Link>
                            <div className=" mt-2"/>
                        </div>

                        {/* Two column layout: Description + Meta */}
                        <div className="flex font-mono  mb-12">
                            {/* Left column - Description */}
                            <div className="flex-[3] pr-30   text-[9pt] font-mono leading-tight space-y-6 text-justify">
                                {product.description ? (
                                    <div className="whitespace-pre-wrap">
                                        {product.description}
                                    </div>
                                ) : (
                                    <>
                                        <p className="font-mono">
                                            Lorem ipsum dolor sit amet consectetur adipiscing elit. Quisque faucibus ex
                                            sapien vitae pellentesque sem placerat. In id cursus mi pretium tellus duis
                                            convallis. Tempus leo eu aenean sed diam urna tempor. Pulvinar vivamus
                                            fringilla lacus nec metus bibendum egestas. Iaculis massa nisl malesuada
                                            lacinia integer nunc posuere. Ut hendrerit semper vel class aptent taciti
                                            sociosqu. Ad litora torquent per conubia nostra inceptos himenaeos.
                                        </p>
                                        <p>
                                            Lorem ipsum dolor sit amet consectetur adipiscing elit. Quisque faucibus ex
                                            sapien vitae pellentesque sem placerat. In id cursus mi pretium tellus duis
                                            convallis. Tempus leo eu aenean sed diam urna tempor.
                                        </p>

                                    </>
                                )}
                            </div>

                            {/* Right column - Product meta */}
                            <div className="flex-[2] text-[9pt] text-right space-y-1">
                                {product.material && (
                                    <div className="font-mono lowercase text-[10pt] font-bold">{product.material}</div>
                                )}
                                {product.color && (
                                    <div className="lowercase font-bold mb-8">{product.color}</div>
                                )}
                                {designerLabel && (
                                    <div>{designerLabel}</div>
                                )}
                                <div className="font-bold mt-8">{formatPrice(product.price)}</div>
                            </div>
                        </div>
                    </div>

                    {/* Bottom - Size Picker */}
                    <div className="w-full pb-40 pl-26 space-y-2">
                        {/* Size Header Row */}
                        <div className="flex items-center mb-4 gap-20">
                            <div className="flex-1 border-t-3 border-black"/>
                            <div className="text-[9pt] uppercase font-bold mt-1 whitespace-nowrap">
                                SELECT SIZE
                            </div>
                        </div>

                        {/* Sizes */}
                        <div className="flex justify-between mb-12">
                            {allSizes.map(size => {
                                const isAvailable = size.available > 0
                                const isSelected = selectedSize === size.size

                                return (
                                    <button
                                        key={size.id}
                                        onClick={() =>
                                            isAvailable && setSelectedSize(size.size)
                                        }
                                        disabled={!isAvailable}
                                        className={`text-[8pt] hover:bg-slate-200 px-2 py-1 cursor-none font-semibold ${
                                            !isAvailable
                                                ? ' opacity-25 cursor-not-allowed'
                                                : isSelected
                                                    ? 'font-bold text-[8pt] bg-slate-200 border-dashed'
                                                    : 'hover:'
                                        }`}
                                    >
                                        {getSizeNumber(size.size)}
                                    </button>
                                )
                            })}
                        </div>

                        {/* Actions */}
                        <div className="flex justify-between">
                            <button className="text-[9pt] italic underline hover:no-underline">
                                size guide
                            </button>
                            <button
                                onClick={handleAdd}
                                disabled={!selectedSize}
                                className="text-[9pt] uppercase font-bold decoration-2 decoraction-offset-3 hover:bg-slate-200 pr-1  hover:underline-0 pl-1 py-1 underline disabled:opacity-30 disabled:no-underline"
                            >
                                ADD
                            </button>
                        </div>
                    </div>
                </div>

                {/* Right Side - Scrollable Images (Full Width) */}
                <div
                    ref={scrollContainerRef}
                    className="w-full h-screen pl-[440px] overflow-y-scroll "
                    style={{
                        scrollbarWidth: 'none',
                        msOverflowStyle: 'none',
                    }}
                >
                    <style jsx>{`
                        div::-webkit-scrollbar {
                            display: none;
                        }
                    `}</style>

                    <div className="space-y-20">
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
        </div>
    )
}
