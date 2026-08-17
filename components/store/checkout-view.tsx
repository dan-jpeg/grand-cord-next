'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useCart } from '@/contexts/cart-context'
import { formatPrice } from '@/lib/utils'
import { createCheckoutSession } from '@/app/(store)/checkout/actions'
import { CartItemTextStatic } from '@/components/store/cart-item-static'

type CheckoutVariant = 'minimal' | 'original'

export function CheckoutView() {
    const router = useRouter()
    const { items, totalPrice, clearCart } = useCart()
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [orderPlaced, setOrderPlaced] = useState(false)
    const [isMobile, setIsMobile] = useState(false)
    const [variant] = useState<CheckoutVariant>('minimal') // Change to 'original' to switch

    // Form state
    const [email, setEmail] = useState('')
    const [name, setName] = useState('')
    const [address, setAddress] = useState('')
    const [city, setCity] = useState('')
    const [state, setState] = useState('')
    const [zip, setZip] = useState('')
    const [country, setCountry] = useState('USA')

    useEffect(() => {
        if (items.length === 0 && !orderPlaced) {
            router.push('/cart')
        }
    }, [items, router, orderPlaced])

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 1024)
        checkMobile()
        window.addEventListener('resize', checkMobile)
        return () => window.removeEventListener('resize', checkMobile)
    }, [])

    if (items.length === 0) {
        return null
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setIsSubmitting(true)
        setOrderPlaced(true)

        try {
            const orderData = {
                email,
                shippingAddress: {
                    name,
                    address,
                    city,
                    state,
                    zip,
                    country,
                },
                items: items.map(item => ({
                    productId: item.productId,
                    productName: item.productName,
                    productSlug: item.productSlug,
                    size: item.size,
                    quantity: item.quantity,
                    price: item.price,
                })),
                total: totalPrice,
            }

            const { url } = await createCheckoutSession(orderData)

            if (!url) throw new Error('No checkout URL returned')

            clearCart()

            window.location.href = url
        } catch (error) {
            console.error('Checkout error:', error)
            alert('Checkout failed. Please try again.')
            setIsSubmitting(false)
            setOrderPlaced(false)
        }
    }

    // Minimal variant
    if (variant === 'minimal') {
        return (
            <div className="min-h-[calc(100*var(--vh))] bg-white flex flex-col items-center justify-center py-16 px-6">
                {/* Cart Items - Desktop Only */}
                {!isMobile && (
                    <div className="absolute top-8 right-8 flex gap-16">
                        {items.slice(0, 3).map((item, index) => (
                            <div key={`${item.productId}-${item.size}`} className="pl-[36px]">
                                <CartItemTextStatic item={item} index={index} />
                            </div>
                        ))}
                    </div>
                )}

                {/* Form Container */}
                <div className="w-full max-w-[400px] border border-black p-12">
                    <form onSubmit={handleSubmit} className="space-y-8">
                        {/* Contact Information */}
                        <div>
                            <div className="font-bold text-[10pt] mb-4">Contact Information:</div>
                            <div>
                                <div className="font-bold text-[10pt] -mb-1">Email:</div>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full border-b border-black bg-transparent focus:outline-none text-[10pt] pb-1"
                                    required
                                />
                            </div>
                        </div>

                        {/* Shipping Information */}
                        <div>
                            <div className="font-bold text-[10pt] mb-4">Shipping Information:</div>

                            <div className="space-y-4">
                                <div>
                                    <div className="font-bold text-[10pt] -mb-1">Full Name:</div>
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="w-full border-b border-black bg-transparent focus:outline-none text-[10pt] pb-1"
                                        required
                                    />
                                </div>

                                <div>
                                    <div className="font-bold text-[10pt] -mb-1">Address:</div>
                                    <input
                                        type="text"
                                        value={address}
                                        onChange={(e) => setAddress(e.target.value)}
                                        className="w-full border-b border-black bg-transparent focus:outline-none text-[10pt] pb-1"
                                        required
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-6">
                                    <div>
                                        <div className="font-bold text-[10pt] -mb-1">City:</div>
                                        <input
                                            type="text"
                                            value={city}
                                            onChange={(e) => setCity(e.target.value)}
                                            className="w-full border-b border-black bg-transparent focus:outline-none text-[10pt] pb-1"
                                            required
                                        />
                                    </div>

                                    <div>
                                        <div className="font-bold text-[10pt] -mb-1">State:</div>
                                        <input
                                            type="text"
                                            value={state}
                                            onChange={(e) => setState(e.target.value)}
                                            className="w-full border-b border-black bg-transparent focus:outline-none text-[10pt] pb-1"
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-6">
                                    <div>
                                        <div className="font-bold text-[10pt] -mb-1">Zip Code:</div>
                                        <input
                                            type="text"
                                            value={zip}
                                            onChange={(e) => setZip(e.target.value)}
                                            className="w-full border-b border-black bg-transparent focus:outline-none text-[10pt] pb-1"
                                            required
                                        />
                                    </div>

                                    <div>
                                        <div className="font-bold text-[10pt] -mb-1">Country:</div>
                                        <input
                                            type="text"
                                            value={country}
                                            onChange={(e) => setCountry(e.target.value)}
                                            className="w-full border-b border-black bg-transparent focus:outline-none text-[10pt] pb-1"
                                            required
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* All Fields Required */}
                        <div className="text-center text-[9pt] pt-12 pb-6">
                            (all fields required)
                        </div>

                        {/* Submit Button */}
                        <div className="flex justify-end">
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="text-[10pt] underline hover:no-underline hover:bg-slate-200 px-2 disabled:opacity-50 transition-opacity"
                            >
                                {isSubmitting ? 'Processing...' : 'Continue to Payment'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        )
    }

    // Original variant
    return (
        <div className="min-h-[calc(100*var(--vh))] bg-white">
            <div className="max-w-6xl mx-auto px-8 py-16">
                <div className="border-b border-black pb-4 mb-8">
                    <h1 className="text-[9pt] font-bold uppercase">Checkout</h1>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label htmlFor="email" className="block text-[9pt] font-bold uppercase mb-2">
                                Email *
                            </label>
                            <input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full px-4 py-3 border border-black focus:outline-none"
                                required
                            />
                        </div>

                        <div className="border-t border-neutral-200 pt-6">
                            <h2 className="text-[9pt] font-bold uppercase mb-4">Shipping Address</h2>

                            <div className="space-y-4">
                                <div>
                                    <label htmlFor="name" className="block text-[9pt] mb-2">
                                        Full Name *
                                    </label>
                                    <input
                                        id="name"
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="w-full px-4 py-3 border border-black focus:outline-none"
                                        required
                                    />
                                </div>

                                <div>
                                    <label htmlFor="address" className="block text-[9pt] mb-2">
                                        Address *
                                    </label>
                                    <input
                                        id="address"
                                        type="text"
                                        value={address}
                                        onChange={(e) => setAddress(e.target.value)}
                                        className="w-full px-4 py-3 border border-black focus:outline-none"
                                        required
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label htmlFor="city" className="block text-[9pt] mb-2">
                                            City *
                                        </label>
                                        <input
                                            id="city"
                                            type="text"
                                            value={city}
                                            onChange={(e) => setCity(e.target.value)}
                                            className="w-full px-4 py-3 border border-black focus:outline-none"
                                            required
                                        />
                                    </div>

                                    <div>
                                        <label htmlFor="state" className="block text-[9pt] mb-2">
                                            State *
                                        </label>
                                        <input
                                            id="state"
                                            type="text"
                                            value={state}
                                            onChange={(e) => setState(e.target.value)}
                                            className="w-full px-4 py-3 border border-black focus:outline-none"
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label htmlFor="zip" className="block text-[9pt] mb-2">
                                            Zip Code *
                                        </label>
                                        <input
                                            id="zip"
                                            type="text"
                                            value={zip}
                                            onChange={(e) => setZip(e.target.value)}
                                            className="w-full px-4 py-3 border border-black focus:outline-none"
                                            required
                                        />
                                    </div>

                                    <div>
                                        <label htmlFor="country" className="block text-[9pt] mb-2">
                                            Country *
                                        </label>
                                        <input
                                            id="country"
                                            type="text"
                                            value={country}
                                            onChange={(e) => setCountry(e.target.value)}
                                            className="w-full px-4 py-3 border border-black focus:outline-none"
                                            required
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full bg-black text-white py-3 text-[9pt] uppercase font-bold hover:bg-neutral-800 disabled:opacity-50 transition-colors"
                        >
                            {isSubmitting ? 'Processing...' : 'Continue to Payment'}
                        </button>
                    </form>

                    {/* Order Summary */}
                    <div>
                        <div className="border border-black p-6">
                            <h2 className="text-[9pt] font-bold uppercase mb-4">Order Summary</h2>

                            <div className="space-y-4 mb-6">
                                {items.map((item) => (
                                    <div key={`${item.productId}-${item.size}`} className="flex justify-between text-sm">
                                        <div>
                                            <div className="font-bold">{item.productName}</div>
                                            <div className="text-[9pt] text-neutral-600">
                                                Size: {item.size} • Qty: {item.quantity}
                                            </div>
                                        </div>
                                        <div className="font-bold">
                                            {formatPrice(item.price * item.quantity)}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="border-t border-black pt-4">
                                <div className="flex justify-between items-center">
                                    <span className="text-[9pt] font-bold uppercase">Total</span>
                                    <span className="text-xl font-bold">{formatPrice(totalPrice)}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}