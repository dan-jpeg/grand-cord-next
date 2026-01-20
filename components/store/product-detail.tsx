'use client'

import { useState, useRef, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useCart } from '@/contexts/cart-context'
import { formatPrice } from '@/lib/utils'
import { motion } from 'framer-motion'
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

export function ProductDetail({ product }: { product: ProductWithSizes }) {
    const { addItem } = useCart()
    const [selectedSize, setSelectedSize] = useState<string>('')
    const [isMobile, setIsMobile] = useState(false)
    const [shouldFlash, setShouldFlash] = useState(false)
    const scrollContainerRef = useRef<HTMLDivElement>(null)
    const sizePickerRef = useRef<HTMLDivElement>(null)

    const images = product.images as ImageData[]
    const displayImage =
        images.find(img => img.isDesktopPrimary)?.url || images[0]?.url
    const mobileImage =
        images.find(img => img.isMobilePrimary)?.url || images[0]?.url
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
        const checkMobile = () => setIsMobile(window.innerWidth < 1024)
        checkMobile()
        window.addEventListener('resize', checkMobile)
        return () => window.removeEventListener('resize', checkMobile)
    }, [])

    function handleAdd() {
        // If no size selected, flash and scroll to size picker
        if (!selectedSize) {
            setShouldFlash(true)
            setTimeout(() => setShouldFlash(false), 600) // 3 flashes * 200ms = 600ms

            if (sizePickerRef.current) {
                sizePickerRef.current.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center'
                })
            }
            return
        }

        // Add to cart
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

        setSelectedSize('')
    }

    // Mobile Layout
    if (isMobile) {
        return (
            <div className="min-h-screen bg-white pb-32">
                {/* Hero Image */}
                <div className="w-full">
                    {mobileImage && (
                        <Image
                            src={mobileImage}
                            alt={product.name}
                            width={3587}
                            height={4400}
                            className="w-full h-auto"
                            priority
                        />
                    )}
                </div>

                {/* Content */}
                <div className="px-6 pt-8">
                    {/* Breadcrumb */}
                    <Link href="/#catalog" className="inline-block mb-4">
                        <div className="text-[8pt]">
                            catalog / {product.name}
                        </div>
                    </Link>
                    <div className="border-t-2 border-black mb-8" />

                    {/* Product Info */}
                    <div className="mb-8">
                        <div className="text-[8pt] space-y-1 mb-6">
                            {product.material && (
                                <div className="lowercase font-bold">{product.material}</div>
                            )}
                            {product.color && (
                                <div className="lowercase font-bold">{product.color}</div>
                            )}
                            {product.designerName && (
                                <div className="mt-4">{product.designerName}</div>
                            )}
                            <div className="font-bold mt-4">
                                {formatPrice(product.price)}
                            </div>
                        </div>

                        {/* Description */}
                        <div className="text-[8pt] leading-tight tracking-tight font-mono space-y-4 text-justify">
                            {product.description ? (
                                <div className="whitespace-pre-wrap">
                                    {product.description}
                                </div>
                            ) : (
                                <>
                                    <p>
                                        Lorem ipsum dolor sit amet consectetur adipiscing elit. Quisque faucibus ex sapien vitae pellentesque sem placerat. In id cursus mi pretium tellus duis convallis. Tempus leo eu aenean sed diam urna tempor. Pulvinar vivamus fringilla lacus nec metus bibendum egestas.
                                    </p>
                                    <p>
                                        Lorem ipsum dolor sit amet consectetur adipiscing elit. Quisque faucibus ex sapien vitae pellentesque sem placerat. In id cursus mi pretium tellus duis convallis.
                                    </p>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Additional Images */}
                    <div className="space-y-8 mb-12">
                        {imageArray.slice(1).map((img, index) => (
                            <Image
                                key={index}
                                src={img}
                                alt={`${product.name} ${index + 2}`}
                                width={3587}
                                height={4400}
                                className="w-full h-auto"
                            />
                        ))}
                    </div>

                    {/* SIZE PICKER with flash animation */}
                    <motion.div
                        ref={sizePickerRef}
                        className="w-full space-y-2 mb-8"
                        animate={{
                            backgroundColor: shouldFlash
                                ? ['#ffffff', '#fef08a', '#ffffff', '#fef08a', '#ffffff', '#fef08a', '#ffffff']
                                : '#ffffff'
                        }}
                        transition={{
                            duration: 0.6,
                            times: [0, 0.14, 0.28, 0.42, 0.56, 0.7, 1]
                        }}
                    >
                        {/* Size Header Row */}
                        <div className="flex items-center mb-4 gap-8">
                            <div className="flex-1 border-t-2 border-black" />
                            <div className="text-[7pt] uppercase font-bold mt-1 whitespace-nowrap">
                                SELECT SIZE
                            </div>
                        </div>

                        {/* Sizes */}
                        <div className="flex justify-between mb-8">
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
                                        className={`text-[8pt] hover:bg-slate-200 px-3 py-2 font-semibold ${
                                            !isAvailable
                                                ? 'opacity-25 cursor-not-allowed'
                                                : isSelected
                                                    ? 'font-bold bg-slate-200 border-dashed'
                                                    : ''
                                        }`}
                                    >
                                        {getSizeNumber(size.size)}
                                    </button>
                                )
                            })}
                        </div>

                        {/* Size Guide */}
                        <div className="flex justify-start">
                            <button className="text-[8pt] italic underline hover:no-underline">
                                size guide
                            </button>
                        </div>
                    </motion.div>
                </div>

                {/* Fixed ADD Button */}
                <motion.button
                    onClick={handleAdd}
                    className={`fixed bottom-8 right-6 text-[10pt] uppercase font-bold px-6 py-3 ${
                        selectedSize
                            ? 'bg-slate-200 border-dashed'
                            : 'd'
                    }`}
                    whileTap={{ scale: 0.95 }}
                >
                    {selectedSize ? 'ADD' : 'SELECT SiZE'}
                </motion.button>
            </div>
        )
    }

    // Desktop Layout (existing code)
    return (
        <div className="h-screen overflow-hidden flex justify-center">
            <div className="flex w-full max-w-[1200px]">
                {/* LEFT — TEXT */}
                <div className="w-1/2 flex flex-col justify-between px-6 lg:px-24 pt-32 pb-40">
                    {/* Header */}
                    <div className="mb-4">
                        <Link href="/#catalog" className="inline-block mb-2">
                            <div className="text-[8pt]">
                                catalog / {product.name}
                            </div>
                        </Link>
                        <div className="border-t-2 border-black" />
                    </div>

                    {/* Description + meta */}
                    <div className="flex-1 flex gap-4 overflow-visible">
                        <div className="flex-[3] text-[8pt] leading-tight tracking-tight font-mono space-y-4 text-justify">
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
                                </>
                            )}
                        </div>

                        <div className="flex-[2] flex justify-end overflow-visible">
                            <div className="text-[8pt] text-right space-y-0">
                                {product.material && (
                                    <div className="lowercase font-bold whitespace-nowrap">{product.material}</div>
                                )}
                                {product.color && (
                                    <div className="lowercase font-bold whitespace-nowrap mb-20">{product.color}</div>
                                )}
                                {product.designerName && (
                                    <div className="whitespace-nowrap mb-[100px]">{product.designerName}</div>
                                )}
                                <div className="font-bold whitespace-nowrap">
                                    {formatPrice(product.price)}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* SIZE PICKER */}
                    <div className="w-full pb-24 space-y-2">
                        {/* Size Header Row */}
                        <div className="flex items-center mb-4 gap-20">
                            <div className="flex-1 border-t-2 border-black" />
                            <div className="text-[7pt] uppercase font-bold mt-1 whitespace-nowrap">
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
                                                ? 'opacity-25 cursor-not-allowed'
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
                            <button className="text-[8pt] italic underline hover:no-underline">
                                size guide
                            </button>
                            <button
                                onClick={handleAdd}
                                disabled={!selectedSize}
                                className="text-[8pt] uppercase font-bold decoration-2 decoraction-offset-3 hover:bg-slate-200 pr-1 hover:underline-0 pl-1 py-1 underline disabled:opacity-30 disabled:no-underline"
                            >
                                ADD
                            </button>
                        </div>
                    </div>
                </div>

                {/* RIGHT — IMAGES with snap scrolling */}
                <div
                    ref={scrollContainerRef}
                    className="w-1/2 pr-6 lg:pr-12 h-screen overflow-y-scroll"
                    style={{
                        scrollSnapType: 'y mandatory',
                        overscrollBehavior: 'contain',
                    }}
                >
                    <style jsx>{`
                        div::-webkit-scrollbar {
                            display: none;
                        }
                    `}</style>

                    {/* Spacer at top */}
                    <div className="h-42"/>

                    {imageArray.map((img, index) => (
                        <div
                            key={index}
                            className="snap-start"
                            style={{scrollMarginTop: '10rem'}}
                        >
                            <Image
                                src={img}
                                alt={`${product.name} ${index + 1}`}
                                width={3587}
                                height={4400}
                                className="w-full h-auto"
                                priority={index === 0}
                            />
                            {index < imageArray.length - 1 && (
                                <div className="h-40"/>
                            )}
                        </div>
                    ))}

                    {/* Spacer at bottom */}
                    <div className="h-[600px]"/>
                </div>
            </div>
        </div>
    )
}