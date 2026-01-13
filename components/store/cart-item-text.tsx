'use client'

import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { formatPrice } from '@/lib/utils'
import { useCart } from '@/contexts/cart-context'
import type { CartItem } from '@/contexts/cart-context'

type CartItemTextProps = {
    item: CartItem
    index: number
    hoveredIndex: number | null
    onHover: (index: number | null) => void
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

export function CartItemText({ item, index, hoveredIndex, onHover }: CartItemTextProps) {
    const { updateQuantity, removeItem } = useCart()
    const isHovered = hoveredIndex === index

    return (
        <motion.div
            className="cursor-pointer relative"
            onMouseEnter={() => onHover(index)}
            onMouseLeave={() => onHover(null)}
            animate={{
                opacity: hoveredIndex === null || hoveredIndex === index ? 1 : 0.5
            }}
            transition={{ duration: 0.2 }}
        >
            {/* Index Number */}
            <div className="absolute -left-[36px] font-bold top-0 text-[10pt]">
                {index + 1}.
            </div>

            <Link
                href={`/products/${item.productSlug}`}
                className="block hover:underline"
            >
                <h3 className="text-[10pt] -mb-1 font-bold uppercase">{item.productName}</h3>
            </Link>

            <div className="font-bold text-[10pt]">
                <div className="-mb-1">Size: {getSizeNumber(item.size)}</div>
                {item.material && <div className="-mb-1 lowercase">{item.material}</div>}
                <div className="font-bold">{formatPrice(item.price)}</div>
            </div>

            {/* Remove Button - Appears on Hover */}
            <AnimatePresence>
                {isHovered && (
                    <motion.button
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        transition={{ duration: 0.2 }}
                        onClick={() => removeItem(item.productId, item.size)}
                        className="text-[10pt] underline hover:no-underline mt-1"
                    >
                        Remove
                    </motion.button>
                )}
            </AnimatePresence>
        </motion.div>
    )
}