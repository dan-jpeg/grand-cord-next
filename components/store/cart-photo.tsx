'use client'

import { motion } from 'framer-motion'
import Image from 'next/image'
import type { CartItem } from '@/contexts/cart-context'

type CartPhotoProps = {
    item: CartItem
    index: number
    hoveredIndex: number | null
    onHover: (index: number | null) => void
}

export function CartPhoto({ item, index, hoveredIndex, onHover }: CartPhotoProps) {
    return (
        <motion.div
            className="relative cursor-pointer"
            onMouseEnter={() => onHover(index)}
            onMouseLeave={() => onHover(null)}
            animate={{
                opacity: hoveredIndex === null || hoveredIndex === index ? 1 : 0.5
            }}
            transition={{ duration: 0.2 }}
        >
            {item.image ? (
                <div className="relative">
                    <Image
                        src={item.image}
                        alt={item.productName}
                        width={200}
                        height={255}
                        className="w-32 h-auto"
                    />
                    {/* Quantity Badge - Bottom Right */}
                    <div className="absolute bottom-[-2px] right-15  border-black px-2 py-1 text-[10pt] font-bold">
                        x {item.quantity}
                    </div>
                </div>
            ) : (
                <div className="w-full aspect-[4/5] bg-neutral-100 flex items-center justify-center text-neutral-400 text-xs">
                    No Image
                </div>
            )}
        </motion.div>
    )
}