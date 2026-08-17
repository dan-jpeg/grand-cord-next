'use client'

import { useState } from 'react'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { formatPrice } from '@/lib/utils'
import { useCart } from '@/contexts/cart-context'

export function CartCardBenDesktop({ item }: { item: any }) {
    const { removeItem } = useCart()
    const [isHovered, setIsHovered] = useState(false)

    return (
        // The motion element has to be the row itself, not a child of a plain
        // wrapper: AnimatePresence mode="popLayout" can only pull an exiting
        // card out of the layout flow when its own direct child is the motion
        // component. Nested, the removed card kept its 220px row until an
        // unrelated re-render dropped it.
        <motion.div
            layout
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className="flex font-inter justify-center"
        >
            <div className="grid grid-cols-[180px_220px_140px] items-start">
                {/* PHOTO */}
                <div
                    className="relative w-[180px] h-[220px] bg-[#f2f2f2] transition-colors duration-1"

                >
                    <Image
                        src={item.image}
                        alt={item.productName}
                        fill
                        className="object-contain"
                    />
                </div>

                {/* META COLUMN */}
                <div
                    className="flex py-4  justify-between text-[8pt] pb-19  transition-colors duration-1"
                    style={{ backgroundColor: isHovered ? '#FCFDF0' : 'transparent' }}
                >
                    {/* Quantity */}
                    <span className="pl-8 mt-4 font-bold">{item.quantity}</span>

                    {/* Right stack */}
                    <div className="flex flex-col mt-4 pr-16 items-end gap-6">
                        <span>{formatPrice(item.price)}. 00</span>

                        <span>
                            size {item.size}
                        </span>

                        {isHovered && (
                            <motion.button
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.001 }}
                                onClick={() => removeItem(item.productId, item.size)}
                                className="underline  mt-4 hover:no-underline"
                            >
                                remove
                            </motion.button>
                        )}
                    </div>
                </div>

                {/* DETAILS COLUMN */}
                <div className="text-[8pt] py-4 mt-4 text-right space-y-0">
                    {/* Product Name */}
                    <div className="uppercase text-right font-bold tracking-wide mb-6">
                        {item.productName}
                    </div>

                    {/* Material */}
                    <div>
                        {item.material}
                    </div>

                    {/* Color */}
                    <div>
                        {item.color}
                    </div>
                </div>
            </div>
        </motion.div>
    )
}