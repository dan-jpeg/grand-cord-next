'use client'

import { useState } from 'react'
import Link from 'next/link'
import { formatPrice } from '@/lib/utils'
import { ProductForm } from './product-form'
import type { Product, ProductSize, Order, OrderItem } from '@prisma/client'

type ProductWithSizes = Product & {
    sizes: ProductSize[]
}

type OrderWithItems = Order & {
    items: OrderItem[]
}

export function ProductDetailView({
                                      product,
                                      orders,
                                  }: {
    product: ProductWithSizes
    orders: OrderWithItems[]
}) {
    const [activeTab, setActiveTab] = useState<'details' | 'inventory' | 'sales'>('details')

    const totalSold = orders.reduce((sum, order) => {
        return sum + order.items.reduce((itemSum, item) => itemSum + item.quantity, 0)
    }, 0)

    const totalRevenue = orders
        .filter(o => o.status !== 'CANCELLED')
        .reduce((sum, order) => {
            return sum + order.items.reduce((itemSum, item) => itemSum + (item.price * item.quantity), 0)
        }, 0)

    return (
        <div className="p-8">
            {/* Header */}
            <div className="mb-8 pb-4 border-b border-black">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/admin/products" className="text-[9pt] font-bold hover:underline">
                            ← BACK
                        </Link>
                        <h1 className="text-[9pt] font-bold uppercase">{product.name}</h1>
                    </div>
                    <div className="flex items-center gap-4 text-[9pt]">
                        <div>
                            <span className="text-neutral-600">Total Sold:</span>{' '}
                            <span className="font-bold">{totalSold}</span>
                        </div>
                        <div>
                            <span className="text-neutral-600">Revenue:</span>{' '}
                            <span className="font-bold">{formatPrice(totalRevenue)}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-6 mb-6 border-b border-neutral-200">
                <button
                    onClick={() => setActiveTab('details')}
                    className={`pb-2 text-[9pt] font-bold uppercase ${
                        activeTab === 'details'
                            ? 'border-b-2 border-black'
                            : 'text-neutral-500 hover:text-black'
                    }`}
                >
                    Product Details
                </button>
                <button
                    onClick={() => setActiveTab('inventory')}
                    className={`pb-2 text-[9pt] font-bold uppercase ${
                        activeTab === 'inventory'
                            ? 'border-b-2 border-black'
                            : 'text-neutral-500 hover:text-black'
                    }`}
                >
                    Inventory
                </button>
                <button
                    onClick={() => setActiveTab('sales')}
                    className={`pb-2 text-[9pt] font-bold uppercase ${
                        activeTab === 'sales'
                            ? 'border-b-2 border-black'
                            : 'text-neutral-500 hover:text-black'
                    }`}
                >
                    Sales History
                </button>
            </div>

            {/* Content */}
            {activeTab === 'details' && (
                <div className="max-w-4xl">
                    <ProductForm product={product} />
                </div>
            )}

            {activeTab === 'inventory' && (
                <div className="space-y-6">
                    <div className="bg-neutral-50 p-6 border border-neutral-200">
                        <h3 className="text-[9pt] font-bold uppercase mb-4">Inventory by Size</h3>
                        <div className="space-y-4">
                            {product.sizes.map((size) => (
                                <div key={size.id} className="grid grid-cols-5 gap-4 text-[9pt]">
                                    <div className="font-bold">Size {size.size}</div>
                                    <div>
                                        <span className="text-neutral-600">Available:</span>{' '}
                                        <span className="font-bold">{size.available}</span>
                                    </div>
                                    <div>
                                        <span className="text-neutral-600">Committed:</span>{' '}
                                        <span className="font-bold">{size.committed}</span>
                                    </div>
                                    <div>
                                        <span className="text-neutral-600">Total:</span>{' '}
                                        <span className="font-bold">{size.total}</span>
                                    </div>
                                    <div className={size.available === 0 ? 'text-red-600 font-bold' : ''}>
                                        {size.available === 0 ? 'OUT OF STOCK' : 'In Stock'}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'sales' && (
                <div className="space-y-2">
                    {orders.length === 0 ? (
                        <div className="text-center py-8 text-[9pt] text-neutral-500">
                            No sales yet
                        </div>
                    ) : (
                        <>
                            <div className="text-[9pt] font-bold mb-4">
                                {orders.length} {orders.length === 1 ? 'ORDER' : 'ORDERS'}
                            </div>
                            {orders.map((order) => (
                                <Link
                                    key={order.id}
                                    href={`/admin/orders/${order.id}`}
                                    className="flex items-center justify-between py-3 border-b border-neutral-200 text-[9pt] hover:bg-neutral-50"
                                >
                                    <div className="flex-1 font-bold">{order.orderNumber}</div>
                                    <div className="w-48">{order.email}</div>
                                    <div className="w-32">
                                        {order.items.reduce((sum, item) => sum + item.quantity, 0)} units
                                    </div>
                                    <div className="w-32">
                                        {formatPrice(
                                            order.items.reduce((sum, item) => sum + item.price * item.quantity, 0)
                                        )}
                                    </div>
                                    <div className="w-24 uppercase">{order.status}</div>
                                    <div className="w-32 text-neutral-600">
                                        {new Date(order.createdAt).toLocaleDateString()}
                                    </div>
                                </Link>
                            ))}
                        </>
                    )}
                </div>
            )}
        </div>
    )
}