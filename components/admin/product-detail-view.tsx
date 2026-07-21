'use client'

import Link from 'next/link'
import { ProductForm, type Tab } from './product-form'
import type { Product, ProductSize, Order, OrderItem, InventoryChangeLog } from '@prisma/client'

type ProductWithSizes = Product & {
    sizes: ProductSize[]
}

type OrderWithItems = Order & {
    items: OrderItem[]
}

export function ProductDetailView({
    product,
    orders,
    inventoryLogs,
    initialTab,
}: {
    product: ProductWithSizes
    orders: OrderWithItems[]
    inventoryLogs: InventoryChangeLog[]
    initialTab?: Tab
}) {
    return (
        <div className="p-8">
            {/* Header */}
            <div className="mb-8 pb-4 border-b border-black flex items-center gap-4">
                <Link href="/admin/products" className="text-[9pt] font-bold hover:underline">
                    ← BACK
                </Link>
                <h1 className="text-[9pt] font-bold uppercase">{product.name}</h1>
            </div>

            <ProductForm product={product} orders={orders} inventoryLogs={inventoryLogs} initialTab={initialTab} />
        </div>
    )
}
