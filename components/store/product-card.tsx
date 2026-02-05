'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import Image from 'next/image'
import { formatPrice } from '@/lib/utils'
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

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 1024)
        checkMobile()
        window.addEventListener('resize', checkMobile)
        return () => window.removeEventListener('resize', checkMobile)
    }, [])

    const images = (product.images as any) as ImageData[]
    const displayImage = isMobile
        ? images.find(img => img.isMobilePrimary)?.url || images[0]?.url
        : images.find(img => img.isDesktopPrimary)?.url || images[0]?.url

    // Compact view for 2x2 and 3x3 mobile grids
    if (compact && isMobile) {
        return (
            <div className="group font-inter py-[6px]">
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

    // Full view for 1x1 mobile and all desktop
    return (
        <div className="group py-[6px] border-black/20 relative">
            {/* Yellow highlight overlay - moved to cover entire card */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: isHovered ? 0.4 : 0 }}
                transition={{ duration: 0 }}
                className="absolute inset-0 bg-[#FCFDEF]/70  pointer-events-none z-10"
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

            <div className="pl-[12px] bg-gray-100/20 pb-5 pt-3 relative z-50 opacity-90 pr-[3rem]">
                <div className="flex card-div py-2 items-start justify-between text-[11px]">
                    <span className="font-bold">{formatPrice(product.price)}</span>
                    <span className="font-bold uppercase text-[8pt]">
                    {product.name}
                </span>
                </div>

                <div className="flex items-end pt-6 opacity-90 justify-between gap-4">
                    <div className="flex-1">
                        {product.material && (
                            <p className="text-[8pt] font-bold lowercase mt-0.5">
                                {product.material}
                            </p>
                        )}
                        {product.color && (
                            <p className="text-[8pt] font-bold lowercase mt-0.2">
                                {product.color}
                            </p>
                        )}
                    </div>
                    {product.designerName && (
                        <p className="text-[8pt] mt-12">
                            {product.designerName}
                        </p>
                    )}
                </div>
            </div>
        </div>
    )
}