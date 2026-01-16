'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useEffect, useState, useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useCart, type CartItem } from '@/contexts/cart-context'

export function AddToCartNotification() {
    const { items } = useCart()
    const [lastItem, setLastItem] = useState<CartItem | null>(null)
    const [show, setShow] = useState(false)
    const prevItemsLength = useRef(0)

    useEffect(() => {
        // Only trigger when items are ADDED (not removed or updated)
        if (items.length > prevItemsLength.current && items.length > 0) {
            const newest = items[items.length - 1]
            setLastItem(newest)
            setShow(true)

            // Auto-hide after 3 seconds
            const timer = setTimeout(() => {
                setShow(false)
            }, 3000)

            prevItemsLength.current = items.length
            return () => clearTimeout(timer)
        }

        prevItemsLength.current = items.length
    }, [items])

    if (!lastItem) return null

    return (
        <AnimatePresence>
            {show && (
                <motion.div
                    initial={{ y: -120, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -120, opacity: 0 }}
                    transition={{
                        type: 'spring',
                        stiffness: 260,
                        damping: 20
                    }}
                    className="fixed top-8 right-8 z-50"
                >
                    <Link
                        href="/cart"
                        className="flex  flex-col  items-center gap-3 bg-white border-2 border-black px-4 py-3 "
                    >
                        {/* Product thumbnail */}
                        <div className="w-12 h-20 relative bg-neutral-100 flex-shrink-0 border border-neutral-200">
                            {lastItem.image ? (
                                <Image
                                    src={lastItem.image}
                                    alt={lastItem.productName}
                                    fill
                                    className="object-cover"
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-neutral-400 text-[6pt]">
                                    No Image
                                </div>
                            )}
                        </div>

                        {/* Cart icon - simple swap */}
                        <motion.div
                            className="relative w-8 h-8 flex-shrink-0"
                            initial={{ scale: 0.8 }}
                            animate={{ scale: 1 }}
                            transition={{
                                type: 'spring',
                                stiffness: 400,
                                damping: 15,
                                delay: 0.1
                            }}
                        >
                            <Image
                                src="/cart-inflated.svg"
                                alt="Cart"
                                fill
                                className="object-contain"
                            />
                        </motion.div>
                    </Link>
                </motion.div>
            )}
        </AnimatePresence>
    )
}