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
    isGrid1x1Primary?: boolean
    isGrid2x2Primary?: boolean
    isGrid3x3Primary?: boolean
}

type ProductWithSizes = Product & {
    sizes: ProductSize[]
}

export function ProductCard({
                                product,
                                index,
                                compact = false,
                                cols = 1,
                            }: {
    product: ProductWithSizes
    index: number
    compact?: boolean
    cols?: number
}) {
    const [isHovered, setIsHovered] = useState(false)
    const [isMobile, setIsMobile] = useState(false)

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 1024)
        checkMobile()
        window.addEventListener('resize', checkMobile)
        return () => window.removeEventListener('resize', checkMobile)
    }, [])

    const images = product.images as unknown as ImageData[]
    const designerLabel = formatDesignerNames(product.designerNames)
    const keepDesignerSingleLine = product.designerNames.length < 3

    // On mobile, the shopper can switch the catalog grid density (1x1/2x2/3x3),
    // so prefer an image assigned to that specific density before falling
    // back to the general mobile primary.
    const gridRoleKey = cols === 3 ? 'isGrid3x3Primary' : cols === 2 ? 'isGrid2x2Primary' : 'isGrid1x1Primary'
    const displayImage = isMobile
        ? images.find(img => img[gridRoleKey])?.url || images.find(img => img.isMobilePrimary)?.url || images[0]?.url
        : images.find(img => img.isDesktopPrimary)?.url || images[0]?.url

    // Compact view for 2x2 and 3x3 mobile grids
    if (compact && isMobile) {
        const colInRow = cols > 1 ? index % cols : 0
        const isFirstCol = colInRow === 0
        const isLastCol = colInRow === cols - 1
        const namePadding = isFirstCol ? 'pl-[2vw]' : isLastCol ? 'pr-[2vw] text-right' : 'text-center'
        const is2x2 = cols === 2
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
                    {is2x2 ? (
                        <div className=" opacity-90 pt-6 pb-4 grid grid-cols-2 px-[2vw]">
                            <p className="text-left text-[9pt] font-medium pl-[6vw] ">{product.name}</p>
                            <div className="text-right text-[7pt] lowercase leading-[1.3] pr-[6vw]">
                                {product.material && <p>{product.material}</p>}
                            </div>
                        </div>
                    ) : (
                        <div className="pt-3 pb-5">
                            <p className={`text-[7pt]  ${namePadding}`}>{product.name}</p>
                        </div>
                    )}
                </Link>
            </div>
        )
    }

    // Mobile 1x1 view
    if (isMobile) {
        return (
            <div className="group  px-[10vw] pb-4 border-black/20 relative">
                {/* Yellow highlight overlay - moved to cover entire card */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: isHovered ? 0.4 : 0 }}
                    transition={{ duration: 0 }}
                    className="absolute inset-0 pointer-events-none z-10"
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
                    <div className="grid grid-cols-2 text-[clamp(8px,1vw+4px,22px)]">
                        <div className="text-left pl-[5vw] ">
                            <p className="font-medium text-[clamp(10px,calc(1vw_+_8px),25px)] ">{product.name}</p>
                            {designerLabel && (
                                <p className={`mt-4 ${keepDesignerSingleLine ? 'whitespace-nowrap' : ''}`}>
                                    {designerLabel}
                                </p>
                            )}

                        </div>
                        <div className="text-right  pr-[6vw]">
                            {product.material && (
                                <p className="  lowercase mt-0">
                                    {product.material}
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
        <div className="group  border-black/20 relative mb-20">
            {/* Yellow highlight overlay - moved to cover entire card */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: isHovered ? 0.4 : 0 }}
                transition={{ duration: 0 }}
                className="absolute inset-0 bg-[#FCFDEF] pointer-events-none z-10"
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

            <div className=" /20 pb-6 pt-20 relative z-20 opacity-90 pr-[1px]">
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
                            </p>                        )}
                    </div>
                    <div className="text-right pr-12">
                        <p className="">{product.name}</p>

                        {designerLabel && (
                            <p className={`mt-12 text-[6.5pt] xl:text-[8pt] ${keepDesignerSingleLine ? 'whitespace-nowrap' : ''}`}>{designerLabel}</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
