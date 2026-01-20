'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { useCart, type CartItem } from '@/contexts/cart-context'
import Image from 'next/image'
import { usePathname } from 'next/navigation'

export function Navigation() {
    const { totalItems, items } = useCart()
    const pathname = usePathname()
    const [lastItem, setLastItem] = useState<CartItem | null>(null)
    const [show, setShow] = useState(false)
    const [isCartHovered, setIsCartHovered] = useState(false)
    const [isMobile, setIsMobile] = useState(false)
    const prevTotalItems = useRef(0)

    // Check if mobile
    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 1024)
        checkMobile()
        window.addEventListener('resize', checkMobile)
        return () => window.removeEventListener('resize', checkMobile)
    }, [])

    // Only trigger notification when totalItems INCREASES
    useEffect(() => {
        if (totalItems > prevTotalItems.current && items.length > 0) {
            const newest = items[items.length - 1]
            setLastItem(newest)
            setShow(true)

            // Auto-hide after 3 seconds
            const timer = setTimeout(() => {
                setShow(false)
            }, 3000)

            prevTotalItems.current = totalItems
            return () => clearTimeout(timer)
        }

        // Always update ref to track current value
        prevTotalItems.current = totalItems
    }, [totalItems, items])

    // Hide navigation on mobile cart page
    if (isMobile && pathname === '/cart') {
        return null
    }

    return (
        <nav className="fixed top-0  left-0 right-0 border-black z-50">
            <div className="mx-auto px-8 py-12 md:py-4 flex items-center justify-between">
                <Link href="/" className="z-50 text-[9pt] font-bold uppercase hover:underline">
                    ⚉
                </Link>

                <div className="flex items-center gap-4">
                    {/* Add to cart notification */}
                    <AnimatePresence>
                        {show && lastItem && (
                            <motion.div
                                initial={{opacity: 0, x: 20}}
                                animate={{opacity: 1, x: 0}}
                                exit={{opacity: 0, x: 20}}
                                transition={{
                                    type: 'spring',
                                    stiffness: 260,
                                    damping: 20
                                }}
                                className="flex items-center gap-1 text-[8pt]"
                            >
                                <span className="font-bold">+</span>
                                <span className="bg-slate-200/70 hover:bg-yellow-300/60 rounded-full px-1 py-0 font-bold uppercase relative">
                                    {lastItem.productName}
                                </span>
                                <Image
                                    src="/crate-open.svg"
                                    alt="Added"
                                    width={24}
                                    height={24}
                                    className="w-5 h-4"
                                />
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Cart icon with hover animation */}
                    <Link
                        href="/cart"
                        className="relative hover:bg-yellow-200/30 px-2 rounded-full flex items-center gap-2 transition-opacity"
                        onMouseEnter={() => setIsCartHovered(true)}
                        onMouseLeave={() => setIsCartHovered(false)}
                    >
                        <div className="relative w-5 h-5 overflow-visible">
                            <AnimatePresence mode="wait">
                                {isCartHovered && (
                                    <motion.div
                                        initial={{ y: -4, opacity: 0 }}
                                        animate={{ y: 0, opacity: 1 }}
                                        exit={{ y: -4, opacity: 0 }}
                                        transition={{
                                            type: 'spring',
                                            stiffness: 900,
                                            damping: 40,
                                        }}
                                        className="absolute inset-0"
                                    >
                                        <Image
                                            src="/crate-open.svg"
                                            alt="Cart"
                                            width={20}
                                            height={20}
                                            className="w-5 h-5"
                                        />
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                        {totalItems > 0 && (
                            <span className="text-[9pt] font-bold">({totalItems})</span>
                        )}
                    </Link>
                </div>
            </div>
        </nav>
    )
}