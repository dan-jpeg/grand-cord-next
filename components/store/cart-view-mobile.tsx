'use client'

import { useCart } from '@/contexts/cart-context'
import { formatPrice } from '@/lib/utils'
import Link from 'next/link'
import { motion } from 'framer-motion'

export function CartViewMobile() {
    const { items, updateQuantity, totalPrice, totalItems } = useCart()

    if (items.length === 0) {
        return (
            <div className="min-h-[calc(100*var(--vh))] bg-black flex items-center justify-center p-6">
                <div className="bg-[#EAEAEA] px-6 py-20 max-w-md w-full">
                    <p className="text-center text-[9pt] mb-8">Your cart is empty.</p>
                    <Link
                        href="/"
                        className="block text-center underline text-[9pt] uppercase hover:no-underline"
                    >
                        RETURN
                    </Link>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-[calc(100*var(--vh))] bg-black flex items-start justify-center p-6">
            <div className="bg-[#EAEAEA] w-full max-w-md">
                <div className="px-[25px] pt-[80px] pb-[85px]">
                    {/* Items */}
                    <div className="space-y-0">
                        {items.map((item, index) => (
                            <motion.div
                                key={`${item.productId}-${item.size}`}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.05 }}
                                className="h-[30px] flex items-center border-b border-black text-[9pt]"
                            >
                                {/* Left: Index and Name - fixed width */}
                                <div className="flex items-center gap-2 w-[120px] flex-shrink-0">
                                    <span className="italic">({index + 1})</span>
                                    <span className="font-bold uppercase truncate">{item.productName}</span>
                                </div>

                                {/* Size - fixed width */}
                                <div className="flex items-center gap-1 text-[8pt] w-[60px] flex-shrink-0">
                                    <span>Size</span>
                                    <span className="font-bold">{item.size}</span>
                                </div>

                                {/* Quantity Controls - fixed width */}
                                <div className="flex items-center gap-2 text-[8pt] w-[60px] flex-shrink-0 justify-center">
                                    <button
                                        onClick={() => updateQuantity(item.productId, item.size, item.quantity - 1)}
                                        className="hover:opacity-60"
                                    >
                                        -
                                    </button>
                                    <span className="font-bold w-4 text-center">{item.quantity}</span>
                                    <button
                                        onClick={() => updateQuantity(item.productId, item.size, item.quantity + 1)}
                                        className="hover:opacity-60"
                                    >
                                        +
                                    </button>
                                </div>

                                {/* Price - flex to fill remaining space, right aligned */}
                                <div className="font-bold flex-shrink-0 text-right whitespace-nowrap">
                                    {Math.round(item.price * item.quantity)} USD
                                </div>
                            </motion.div>
                        ))}
                    </div>

                    {/* Subtotal */}
                    <div className="h-[60px] flex items-center justify-between text-[9pt] mt-8">
                        <div className="font-bold uppercase">({totalItems}) ITEMS</div>
                        <div className="font-bold uppercase">SUBTOTAL</div>
                        <div className="font-bold">{Math.round(totalPrice)} USD</div>
                    </div>

                    {/* Checkout Button */}
                    <div className="flex justify-end mt-8 mb-16">
                        <Link
                            href="/checkout"
                            className="text-[9pt] font-bold uppercase underline hover:no-underline"
                        >
                            CHECKOUT
                        </Link>
                    </div>

                    {/* Return Link */}
                    <div className="flex justify-center">
                        <Link
                            href="/"
                            className="text-[9pt] uppercase underline hover:no-underline text-neutral-500"
                        >
                            RETURN
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    )
}