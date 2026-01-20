'use client'

import { useState } from 'react'
import { useCart } from '@/contexts/cart-context'
import { formatPrice } from '@/lib/utils'
import Link from 'next/link'
import { CartPhoto } from '@/components/store/cart-photo'
import { CartItemText } from '@/components/store/cart-item-text'
import { CartViewMobile } from '@/components/store/cart-view-mobile'
import { useEffect, useRef } from 'react'

export function CartView() {
    const { items, totalPrice } = useCart()
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
    const [isMobile, setIsMobile] = useState(false)

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 1024)
        checkMobile()
        window.addEventListener('resize', checkMobile)
        return () => window.removeEventListener('resize', checkMobile)
    }, [])

    // Render mobile version on small screens
    if (isMobile) {
        return <CartViewMobile />
    }




    if (items.length === 0) {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center p-8">
                <div className="text-center">
                    <h1 className="text-[9pt] mb-2">Your cart is empty.</h1>
                    <div className="flex flex-col gap-4 items-center">
                        <Link
                            href="/#catalog"
                            className="inline-block px-2 py-1 italic text-[9pt] hover:bg-yellow-200 text-sm transition-colors"
                        >
                            RETURN
                        </Link>
                        <Link
                            href="/cart/order-status"
                            className="px-3 py-2 text-[9pt] mt-32 uppercase font-bold hover:bg-gray-200 transition-colors"
                        >
                            Check Order Status
                        </Link>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-white">
            {/* Main Content - Responsive Layout */}
            <div className="min-h-screen flex flex-col md:flex-row items-start justify-center">
                {/* Left Side / Top on Mobile - Images Grid */}
                <div className="w-full md:flex-1 md:flex md:justify-end md:pr-[2px]">
                    <div className="w-full md:max-w-4xl py-12 px-8">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                            {items.map((item, index) => (
                                <CartPhoto
                                    key={`${item.productId}-${item.size}-img`}
                                    item={item}
                                    index={index}
                                    hoveredIndex={hoveredIndex}
                                    onHover={setHoveredIndex}
                                />
                            ))}
                        </div>
                    </div>
                </div>

                {/* Center Divider - Hidden on Mobile */}
                <div className="hidden md:flex flex-shrink-0 justify-center min-h-screen">
                    <div className="w-px bg-black"/>
                    <div className="w-[4px]"/>
                    <div className="w-px bg-black"/>
                </div>

                {/* Right Side / Bottom on Mobile - Item Text Grid */}
                <div className="w-full md:flex-1 md:flex md:justify-start md:pl-[2px]">
                    <div className="w-full md:max-w-4xl py-12 px-8">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 md:pl-12">
                            {items.map((item, index) => (
                                <CartItemText
                                    key={`${item.productId}-${item.size}-text`}
                                    item={item}
                                    index={index}
                                    hoveredIndex={hoveredIndex}
                                    onHover={setHoveredIndex}
                                />
                            ))}
                            {/* force new row */}
                            <div className="md:col-span-4" />
                            {/* Checkout Section */}
                            <div className="md:col-start-2 md:col-span-2 mt-12">
                                <div className="flex flex-col md:flex-row items-start md:items-center justify-between md:whitespace-nowrap gap-4 md:gap-0">
                                    <span className="text-[18pt] font-bold">Subtotal</span>
                                    <span className="hidden md:inline text-[18pt] mx-4">——</span>
                                    <span className="text-[18pt] font-bold">{formatPrice(totalPrice)} usd</span>
                                    <Link
                                        href="/checkout"
                                        className="text-[18pt] font-bold underline decoration-3 cursor-none underline-offset-4 hover:bg-slate-200 px-2 hover:no-underline md:ml-12"
                                    >
                                        Checkout
                                    </Link>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}