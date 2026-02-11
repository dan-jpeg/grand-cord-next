'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import Image from 'next/image'
import { formatDesignerNames } from '@/lib/designers'
import type { Product, ProductSize } from '@prisma/client'

type ImageData = {
    url: string
    isMobilePrimary: boolean
    isDesktopPrimary: boolean
}

type ProductWithSizes = Product & {
    sizes: ProductSize[]
}

export function ProductCard({
                                product,
                                index,
                                compact = false
                            }: {
    product: ProductWithSizes
    index: number
    compact?: boolean
}) {
    const [isHovered, setIsHovered] = useState(false)
    const [isMobile, setIsMobile] = useState(false)
    void index

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 1024)
        checkMobile()
        window.addEventListener('resize', checkMobile)
        return () => window.removeEventListener('resize', checkMobile)
    }, [])

    const images = product.images as unknown as ImageData[]
    const designerLabel = formatDesignerNames(product.designerNames)
    const displayImage = isMobile
        ? images.find(img => img.isMobilePrimary)?.url || images[0]?.url
        : images.find(img => img.isDesktopPrimary)?.url || images[0]?.url

    // Compact view for 2x2 and 3x3 mobile grids
    if (compact && isMobile) {
        return (
            <div className="group font-inter ">
                <Link
                    href={`/products/${product.slug}`}
                    className="block relative"
                >
                    <div className="relative">
                        {displayImage ? (
                            <Image
                                src={displayImage}
                                alt={product.name}
                                width={3587}
                                height={4400}
                                className="w-full h-auto"
                                sizes="(max-width: 1024px) 50vw, 33vw"
                            />
                        ) : (
                            <div className="w-full aspect-square flex items-center justify-center text-gray-400">
                                No Image
                            </div>
                        )}
                    </div>
                    <div className="pt-2">
                        <p className="text-[7pt] font-semibold">{product.name}</p>
                    </div>
                </Link>
            </div>
        )
    }

    // Mobile 1x1 view
    if (isMobile) {
        return (
            <div className="group  px-10 border-black/20 relative">
                {/* Yellow highlight overlay - moved to cover entire card */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: isHovered ? 0.4 : 0 }}
                    transition={{ duration: 0 }}
                    className="absolute inset-0 bg-[#FCFDEF]/70 pointer-events-none z-10"
                />

                <Link
                    href={`/products/${product.slug}`}
                    className="block relative"
                    onMouseEnter={() => setIsHovered(true)}
                    onMouseLeave={() => setIsHovered(false)}
                >
                    <div className="relative">
                        {displayImage ? (
                            <Image
                                src={displayImage}
                                alt={product.name}
                                width={3587}
                                height={4400}
                                className="w-full h-auto"
                                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                            />
                        ) : (
                            <div className="w-full aspect-square flex items-center justify-center text-gray-400">
                                No Image
                            </div>
                        )}
                    </div>
                </Link>

                <div className=" bg-gray-100/20 pb-8 pt-6 relative z-20 opacity-90 pr-[1px]">
                    <div className="grid grid-cols-2 text-[9pt]">
                        <div className="text-left pl-[5vw] ">
                            <p className="font-medium text-[11pt]">{product.name}</p>
                            {designerLabel && (
                                <p className="       mt-4">
                                    {designerLabel}
                                </p>
                            )}

                        </div>
                        <div className="text-right  pr-6">
                            {product.material && (
                                <p className="  lowercase mt-0">
                                    {product.material}
                                </p>
                            )}
                            {product.color && (
                                <p className="  lowercase -mt-1">
                                    {product.color}
                                </p>
                            )}


                        </div>
                    </div>
                </div>
            </div>
        )
    }

    // Desktop view
    return (
        <div className="group  border-black/20 relative">
            {/* Yellow highlight overlay - moved to cover entire card */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: isHovered ? 0.4 : 0 }}
                transition={{ duration: 0 }}
                className="absolute inset-0 bg-[#FCFDEF]/70 pointer-events-none z-10"
            />

            <Link
                href={`/products/${product.slug}`}
                className="block relative"
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
            >
                <div className="relative">
                    {displayImage ? (
                        <Image
                            src={displayImage}
                            alt={product.name}
                            width={3587}
                            height={4400}
                            className="w-full h-auto"
                            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                        />
                    ) : (
                        <div className="w-full aspect-square flex items-center justify-center text-gray-400">
                            No Image
                        </div>
                    )}
                </div>
            </Link>

            <div className=" bg-gray-100/20 pb-12 pt-12 relative z-20 opacity-90 pr-[1px]">
                <div className="grid grid-cols-2 text-[8pt]">
                    <div className="text-left pl-[5vw] mt-6">
                        {product.material && (
                            <p className=" font-bold lowercase mt-1">
                                {product.material}
                            </p>
                        )}
                        {product.color && (
                            <p className=" font-bold lowercase mt-0.5">
                                {product.color}
                            </p>
                        )}
                    </div>
                    <div className="text-right pr-12">
                        <p className="">{product.name}</p>

                        {designerLabel && (
                            <p className=" mt-12">{designerLabel}</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
