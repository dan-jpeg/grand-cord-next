'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import Image from 'next/image'
import { formatPrice } from '@/lib/utils'
import type { Product, ProductSize } from '@prisma/client'

type ProductWithSizes = Product & {
    sizes: ProductSize[]
}

export function ProductCard({ product, index }: { product: ProductWithSizes; index: number }) {
    const [isHovered, setIsHovered] = useState(false)

    return (
        <div className="group">
            <Link
                href={`/products/${product.slug}`}
                className="block relative mb-6"
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
            >
                <div className="relative">  {/* Removed aspect-square */}
                    {product.images[0] ? (
                        <Image
                            src={product.images[0]}
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

            <div className=" pl-[12px] opacity-90 pr-[3rem]">
                <div className="flex items-start justify-between  text-sm">
                    <span className="font-bold">{formatPrice(product.price)}</span>
                    <span className="font-bold uppercase text-[9pt] ">
            {product.name}
          </span>
                </div>

                <div className="flex items-end pt-6 opacity-90 justify-between gap-4">
                    <div className="flex-1">
                        {product.material && (
                            <p className="text-[9pt] font-bold  italic lowercase mt-0.5">
                                {product.material}
                            </p>
                        )}
                        {product.color && (
                            <p className="text-[9pt] font-bold  lowercase mt-0.5">
                                {product.color}
                            </p>
                        )}
                    </div>
                    {product.designerName && (
                        <p className="text-[9pt] mt-12 ">
                            {product.designerName}
                        </p>
                    )}
                </div>
            </div>
        </div>
    )
}