'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useCart } from '@/contexts/cart-context'
import type { Product, ProductSize } from '@prisma/client'

type ProductWithSizes = Product & {
    sizes: ProductSize[]
}

export function ProductDetail({ product }: { product: ProductWithSizes }) {
    const router = useRouter()
    const { addItem } = useCart()
    const [selectedSize, setSelectedSize] = useState<string>('')

    const availableSizes = product.sizes
        .filter(s => s.stock > 0)
        .sort((a, b) => {
            const order = ['XS', 'S', 'M', 'L', 'XL', 'XXL']
            return order.indexOf(a.size) - order.indexOf(b.size)
        })

    function handleAdd() {
        if (!selectedSize) {
            alert('Please select a size')
            return
        }

        addItem({
            productId: product.id,
            productName: product.name,
            productSlug: product.slug,
            size: selectedSize,
            price: product.price,
            image: product.images[0],
        })

        alert('Added to cart!')
        // Optional: redirect to cart
        // router.push('/cart')
    }

    return (
        <div className="min-h-screen bg-white flex items-center justify-center p-8">
            <div className="w-full max-w-4xl">
                {/* Product Image */}
                <div className="bg-neutral-100 mb-8 flex items-center justify-center">
                    {product.images[0] ? (
                        <div className="relative w-full max-w-md">
                            <Image
                                src={product.images[0]}
                                alt={product.name}
                                width={3587}
                                height={4400}
                                className="w-full h-auto"
                                priority
                            />
                        </div>
                    ) : (
                        <div className="w-full aspect-[3587/4400] flex items-center justify-center">
                            No Image
                        </div>
                    )}
                </div>

                {/* Product Info */}
                <div className="space-y-4">
                    <div className="flex items-start justify-between text-[9pt] uppercase border-b border-black pb-2">
                        <div className="flex gap-12">
                            <span className="font-bold">PRODUCT NAME</span>
                            <span className="font-bold">MATERIAL</span>
                            <span className="font-bold">COLOR</span>
                        </div>
                        <span className="font-bold">SIZE</span>
                    </div>

                    <div className="flex items-start justify-between">
                        <div className="flex gap-12 text-[9pt]">
                            <span className="w-32">{product.name}</span>
                            <span className="w-32">{product.material || '—'}</span>
                            <span className="w-32">{product.color || '—'}</span>
                        </div>

                        <div className="flex gap-4">
                            {availableSizes.map((size) => (
                                <button
                                    key={size.id}
                                    onClick={() => setSelectedSize(size.size)}
                                    className={`text-[9pt] uppercase px-4 py-1 border border-black ${
                                        selectedSize === size.size
                                            ? 'bg-black text-white'
                                            : 'bg-white text-black hover:bg-neutral-100'
                                    }`}
                                >
                                    {size.size}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Add Button */}
                    <button
                        onClick={handleAdd}
                        className="w-full bg-black text-white text-[9pt] uppercase font-bold py-3 hover:bg-neutral-800 transition-colors"
                    >
                        ADD
                    </button>
                </div>
            </div>
        </div>
    )
}