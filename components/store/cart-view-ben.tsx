'use client'

import { useCart } from '@/contexts/cart-context'
import { formatPrice } from '@/lib/utils'
import Link from 'next/link'
import { CartCardBen } from '@/components/store/cart-card-ben'
import { AnimatePresence } from 'framer-motion'
import {CartCardBenDesktop} from "@/components/store/cart-card-ben-desktop";

export function CartViewBen() {
    const { items, totalPrice } = useCart()

    if (items.length === 0) {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center p-8 font-inter">
                <div className="text-center">
                    <h1 className="text-sm mb-6">Your cart is empty.</h1>
                    <div className="flex  flex-col gap-4 items-center">
                        <Link
                            href="/#catalog"
                            className="inline-block px-4 py-2 text-sm border border-black hover:bg-black hover:text-white transition-colors"
                        >
                            Continue Shopping
                        </Link>
                        <Link
                            href="/cart/order-status"
                            className="text-sm underline hover:no-underline"
                        >
                            Check Order Status
                        </Link>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-white font-inter pb-16">
            <div className="max-w-6xl  px-8 md:max-w-7xl">
                {/* Mobile Layout - Completely Original */}
                <div className="lg:hidden flex flex-col gap-1.5">
                    <AnimatePresence mode="popLayout">
                        {items.map((item) => (
                            <CartCardBen
                                key={`${item.productId}-${item.size}`}
                                item={item}
                            />
                        ))}
                    </AnimatePresence>
                </div>

                {/* Desktop Layout - Two Columns */}
                <div className="hidden lg:flex gap-12 py-16">
                    {/* Left Column - Cart Items */}
                    <div className="flex-1">
                        <div className="flex flex-col gap-1.5">
                            <AnimatePresence mode="popLayout">
                                {items.map((item) => (
                                    <CartCardBenDesktop
                                        key={`${item.productId}-${item.size}`}
                                        item={item}
                                    />
                                ))}
                            </AnimatePresence>
                        </div>
                    </div>

                    {/* Right Column - Order Summary */}
                    <div className="w-[376px]">
                        <div className="sticky top-16">
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 right-0 bg-[#FCFDF0]" style={{ right: '-100vw' }}></div>
                                <div className="relative px-8 pb-2 pt-50    ">
                                    <div className="text-[8.5pt] font-medium">Order Subtotal</div>
                                </div>
                            </div>

                            <div className="mt-4 ml-8"> {/* Use margin, not padding, to shift the whole block */}

                                {/* Top Row: Price and Button */}
                                <div className="flex flex-row justify-between items-end  pb-8">
                                    <div className="text-[8.5pt] pt-4 leading-none font-medium">
                                        $ {totalPrice.toFixed(2)}
                                    </div>

                                    <div className="flex items-center">
                                        <Link
                                            href="/checkout"
                                            className="flex items-center gap-2 text-[8.5pt] font-bold hover:underline leading-none"
                                        >
                                            <span className="text-[6px]">▶</span>
                                            <span>Continue</span>
                                        </Link>
                                    </div>
                                </div>

                                {/* Bottom Row: Footer Text */}
                                {/* 'w-full' ensures it matches the flex container width above */}
                                <div className="mt-2 text-[7pt] italic text-neutral-700 w-full flex justify-between">
        <span>
            Shipping and tax will be calculated next. All orders are shipped from Chicago.
        </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Fixed Bottom Bar - Original Mobile Only */}
            <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-[#FCFDF0] h-35 border-black">
                <div className="flex justify-center">
                    <div className="w-95 px-8 py-6 flex items-center justify-between">
                        <div className="flex flex-col items-start">
                            <span className="text-[10pt] pt-0 mb-3">
                                Order Subtotal
                            </span>
                            <span className="text-[11pt] font-ni">
                                $ {formatPrice(totalPrice)}. 00
                            </span>
                        </div>

                        <Link
                            href="/checkout"
                            className="flex items-center gap-2 mt-8 text-[10pt] font-bold hover:underline"
                        >
                            <span className="text-[7px]">▶</span>
                            <span>Continue</span>
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    )
}