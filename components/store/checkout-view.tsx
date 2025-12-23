'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useCart } from '@/contexts/cart-context'
import { formatPrice } from '@/lib/utils'
import { createCheckoutSession } from '@/app/(store)/checkout/actions'
import { loadStripe } from '@stripe/stripe-js'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

export function CheckoutView() {
    const router = useRouter()
    const { items, totalPrice, clearCart } = useCart()
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [orderPlaced, setOrderPlaced] = useState(false)

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

            // Redirect to Stripe Checkout
            window.location.href = url
        } catch (error) {
            console.error('Checkout error:', error)
            alert('Checkout failed. Please try again.')
            setIsSubmitting(false)
            setOrderPlaced(false)
        }
    }

    return (
        <div className="min-h-screen bg-white">
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

                                <div className="grid grid-cols-2  gap-4">
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
