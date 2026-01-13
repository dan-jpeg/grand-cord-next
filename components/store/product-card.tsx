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
    isCartPrimary: boolean
}

type ProductWithSizes = Product & {
    sizes: ProductSize[]
}

export function ProductCard({ product, index }: { product: ProductWithSizes; index: number }) {
    const [isHovered, setIsHovered] = useState(false)
    const [isMobile, setIsMobile] = useState(false)

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768)
        checkMobile()
        window.addEventListener('resize', checkMobile)
        return () => window.removeEventListener('resize', checkMobile)
    }, [])

    // Parse images from JSON
    const images = (product.images as any) as ImageData[]

    // Get appropriate image based on device
    const displayImage = isMobile
        ? images.find(img => img.isMobilePrimary)?.url || images[0]?.url
        : images.find(img => img.isDesktopPrimary)?.url || images[0]?.url

    return (
        <div className="group py-[6px] border-black/20">
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

                    {/* Black Bar on Hover */}
                    <motion.div
                        initial={{ scaleX: 0 }}
                        animate={{ scaleX: isHovered ? 1 : 0 }}
                        transition={{ duration: 0.001 }}
                        className="absolute top-0 left-0 w-full h-3 bg-neutral-200 origin-left"
                    />
                </div>
            </Link>

            <div className="pl-[12px] bg-gray-100/20 pb-5 pt-3 opacity-90 pr-[3rem]">
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