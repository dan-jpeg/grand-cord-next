'use client'

import { useCart } from '@/contexts/cart-context'
import { formatPrice } from '@/lib/utils'
import Image from 'next/image'
import Link from 'next/link'

export function CartView() {
    const { items, removeItem, updateQuantity, totalPrice } = useCart()

    if (items.length === 0) {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center p-8">
                <div className="text-center">
                    <h1 className="text-[9pt]  mb-2">Your cart is empty.</h1>
                    <div className="flex flex-col gap-4 items-center">
                        <Link
                            href="/"
                            className="inline-block px-2 py-1 italic text-[9pt]  hover:bg-yellow-200 text-sm transition-colors"
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
            <div className="max-w-6xl mx-auto px-8 py-16">
                {/* Header */}
                <div className="border-b border-black pb-4 mb-8">
                    <h1 className="text-[9pt] font-bold uppercase">CART</h1>
                </div>

                {/* Cart Items */}
                <div className="space-y-8 mb-12">
                    {items.map((item) => (
                        <div key={`${item.productId}-${item.size}`}
                             className="flex gap-8 border-b border-neutral-200 pb-8">
                            {/* Image */}
                            <div className="w-32 h-40 bg-neutral-100 flex-shrink-0">
                            {item.image ? (
                                    <Image
                                        src={item.image}
                                        alt={item.productName}
                                        width={128}
                                        height={160}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-neutral-400 text-xs">
                                        No Image
                                    </div>
                                )}
                            </div>

                            {/* Info */}
                            <div className="flex-1">
                                <Link
                                    href={`/products/${item.productSlug}`}
                                    className="font-bold text-sm hover:underline"
                                >
                                    {item.productName}
                                </Link>
                                <div className="text-[9pt] text-neutral-600 mt-1">
                                    Size: {item.size}
                                </div>
                                <div className="text-sm font-bold mt-2">
                                    {formatPrice(item.price)}
                                </div>
                            </div>

                            {/* Quantity */}
                            <div className="flex items-start gap-4">
                                <div className="flex items-center border border-black">
                                    <button
                                        onClick={() => updateQuantity(item.productId, item.size, item.quantity - 1)}
                                        className="px-3 py-1 text-[9pt] hover:bg-neutral-100"
                                    >
                                        −
                                    </button>
                                    <span className="px-4 py-1 text-[9pt] border-x border-black min-w-[3rem] text-center">
                    {item.quantity}
                  </span>
                                    <button
                                        onClick={() => updateQuantity(item.productId, item.size, item.quantity + 1)}
                                        className="px-3 py-1 text-[9pt] hover:bg-neutral-100"
                                    >
                                        +
                                    </button>
                                </div>

                                <button
                                    onClick={() => removeItem(item.productId, item.size)}
                                    className="text-[9pt] underline hover:no-underline"
                                >
                                    Remove
                                </button>
                            </div>

                            {/* Subtotal */}
                            <div className="text-sm font-bold w-24 text-right">
                                {formatPrice(item.price * item.quantity)}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Total & Checkout */}
                <div className="border-t border-black pt-8">
                    <div className="flex items-center justify-between mb-8">
                        <span className="text-[9pt] font-bold uppercase">Total</span>
                        <span className="text-2xl font-bold">{formatPrice(totalPrice)}</span>
                    </div>

                    <div className="flex gap-4">
                        <Link
                            href="/"
                            className="flex-1 text-center border border-black py-3 text-[9pt] uppercase font-bold hover:bg-neutral-100 transition-colors"
                        >
                            return
                        </Link>
                        <Link
                            href="/checkout"
                            className="flex-1 text-center bg-black text-white py-3 text-[9pt] uppercase font-bold hover:bg-neutral-800 transition-colors"
                        >
                            Checkout
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    )
}