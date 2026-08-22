'use client'

import { useEffect, useState } from 'react'
import { useCart } from '@/contexts/cart-context'
import { formatPrice } from '@/lib/utils'
import Link from 'next/link'
import { CartCardBen } from '@/components/store/cart-card-ben'
import { AnimatePresence, motion } from 'framer-motion'
import {CartCardBenDesktop} from "@/components/store/cart-card-ben-desktop";

export function CartViewBen() {
    const { items, totalPrice } = useCart()
    const isEmpty = items.length === 0

    // The desktop cards exit with an opacity-only fade, so the last removed row
    // still holds its 220px of layout until framer unmounts it. Rendering the
    // empty state right away would put "Return to catalog" below that ghost row
    // and then snap it upward on unmount — so wait for the exit to finish.
    const [cardsCleared, setCardsCleared] = useState(true)
    useEffect(() => {
        if (!isEmpty) {
            setCardsCleared(false)
            return
        }
        // onExitComplete covers the normal case; the timer is the fallback for
        // when the fade never reports back (background tab, interrupted anim)
        // so the link can't get stranded off-screen.
        const timer = setTimeout(() => setCardsCleared(true), 400)
        return () => clearTimeout(timer)
    }, [isEmpty])

    // Disable the page's scroll bounce while the cart is open. This page
    // scrolls the document, so overscroll-behavior has to live on <html>, not
    // on a component div. The CSS rule is gated to mobile widths (see globals),
    // so desktop keeps the native bounce.
    useEffect(() => {
        const el = document.documentElement
        el.classList.add('cart-no-bounce')
        return () => el.classList.remove('cart-no-bounce')
    }, [])

    // data-app-zoom="off": the cart renders unscaled at the browser's real resolution,
    // like the PDP and the admin. See the opt-out rule in app/globals.css.
    return (
        <div data-app-zoom="off" className="min-h-[calc(100*var(--dvh))] bg-white font-inter pb-16 max-lg:pb-40 overflow-x-hidden">
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
                    {isEmpty && (
                        <div className="fixed inset-x-0 top-0 bottom-[140px] flex flex-col items-center justify-center gap-2 text-center text-[8.5pt] font-medium">

                            <Link href="/" className="flex items-center gap-2">
                                <span className="text-[6px]">▶</span>
                                <span className="hover:underline hover:underline-offset-4 ">Return to catalog</span>
                            </Link>
                        </div>
                    )}
                </div>

                {/* Desktop Layout - Two Columns */}
                <div className="hidden lg:flex gap-12 py-16">
                    {/* Left Column - Cart Items */}
                    <div className="flex-1">
                        <div className="flex flex-col gap-1.5">
                            <AnimatePresence
                                mode="popLayout"
                                onExitComplete={() => setCardsCleared(true)}
                            >
                                {items.map((item) => (
                                    <CartCardBenDesktop
                                        key={`${item.productId}-${item.size}`}
                                        item={item}
                                    />
                                ))}
                            </AnimatePresence>
                            {isEmpty && cardsCleared && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="flex font-inter justify-center"
                                >
                                    <div className="grid grid-cols-[180px_220px_440px] items-start">
                                        <div />
                                        <div />
                                        <div className="py-4 mt-4 flex justify-end gap-8 pr-12 text-[8.5pt] font-medium">
                                            <Link href="/" className="flex items-center gap-2">
                                                <span className="text-[6px]">▶</span>
                                                <span className=" underline-offset-4 hover:underline">Return to catalog</span>
                                            </Link>
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </div>
                    </div>

                    {/* Right Column - Order Summary */}
                    <div className="w-[376px]">
                        <div className="sticky top-16">
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 right-0 bg-[#FCFDF0]" style={{ right: 'calc(-100*var(--vw))' }}></div>
                                <div className={`relative px-8 pb-2 ${isEmpty ? 'pt-12' : 'pt-50'}`}>
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
                                        {isEmpty ? (
                                            <span
                                                aria-disabled
                                                className="flex items-center gap-2 text-[8.5pt] font-bold leading-none opacity-30 cursor-default"
                                            >
                                                <span className="text-[6px]">▶</span>
                                                <span>Continue</span>
                                            </span>
                                        ) : (
                                            <Link
                                                href="/checkout"
                                                className="flex items-center gap-2 text-[8.5pt] font-bold hover:underline leading-none"
                                            >
                                                <span className="text-[6px]">▶</span>
                                                <span>Continue</span>
                                            </Link>
                                        )}
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

                        {isEmpty ? (
                            <span
                                aria-disabled
                                className="flex items-center gap-2 mt-8 text-[10pt] font-bold opacity-30 cursor-default"
                            >
                                <span className="text-[7px]">▶</span>
                                <span>Continue</span>
                            </span>
                        ) : (
                            <Link
                                href="/checkout"
                                className="flex items-center gap-2 mt-8 text-[10pt] font-bold hover:underline"
                            >
                                <span className="text-[7px]">▶</span>
                                <span>Continue</span>
                            </Link>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}