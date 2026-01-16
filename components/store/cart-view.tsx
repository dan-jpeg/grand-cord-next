'use client'

import { useState } from 'react'
import { useCart } from '@/contexts/cart-context'
import { formatPrice } from '@/lib/utils'
import Link from 'next/link'
import { CartPhoto } from '@/components/store/cart-photo'
import { CartItemText } from '@/components/store/cart-item-text'

export function CartView() {
    const { items, totalPrice } = useCart()
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

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
            {/* Main Content - Split View with Grids */}
            <div className=" min-h-screen flex items-start justify-center">
                {/* Left Side - Images Grid (3 columns + 1 empty) */}
                <div className="flex-1 flex justify-end pr-[2px]">
                    <div className="w-full max-w-4xl py-12 px-8">
                        <div className="grid grid-cols-4 gap-6">
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

                {/* Center Divider - Two 1px lines with 4px gap */}
                {/* Center Divider - Two 1px lines with 4px gap */}
                <div className="flex-shrink-0 flex justify-center min-h-screen">
                    <div className="w-px bg-black"/>
                    <div className="w-[4px]"/>
                    <div className="w-px bg-black"/>
                </div>

                {/* Right Side - Item Text Grid (3 columns + 1 empty) */}
                <div className="flex-1  flex justify-start pl-[2px]">
                    <div className="w-full  max-w-4xl py-12 px-8">
                        <div className="grid pl-12 grid-cols-4 gap-6">
                            {items.map((item, index) => (
                                <CartItemText
                                    key={`${item.productId}-${item.size}-text`}
                                    item={item}
                                    index={index}
                                    hoveredIndex={hoveredIndex}
                                    onHover={setHoveredIndex}
                                />
                            ))}

                            {/* Checkout Section - [empty][subtotal + checkout][empty] */}
                            <div className="col-start-2 col-span-2 mt-12">
                                <div className="flex items-center justify-between whitespace-nowrap">
                                    <span className="text-[18pt] font-bold">Subtotal</span>
                                    <span className="text-[18pt] mx-4">——</span>
                                    <span className="text-[18pt] font-bold">{formatPrice(totalPrice)} usd</span>
                                    <Link
                                        href="/checkout"
                                        className="text-[18pt] font-bold  underline decoration-3 cursor-none underline-offset-4 hover:bg-slate-200 px-2 hover:no-underline ml-12"
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