'use client'

import Link from 'next/link'
import { formatPrice } from '@/lib/utils'
import { ProductActions } from './product-actions'
import type { Product, ProductSize } from '@prisma/client'

type ProductWithSizes = Product & {
    sizes: ProductSize[]
}

export function ProductRow({ product }: { product: ProductWithSizes }) {
    const totalAvailable = product.sizes.reduce((sum, s) => sum + s.available, 0)
    const totalCommitted = product.sizes.reduce((sum, s) => sum + s.committed, 0)
    const totalInventory = product.sizes.reduce((sum, s) => sum + s.total, 0)

    return (
        <div>
            {/* Product Row - Clickable */}
            <Link href={`/admin/products/${product.id}/edit`}>
                <div className="grid grid-cols-12 gap-4 text-[8pt] mb-2 my-4 hover:bg-neutral-50 transition-colors cursor-pointer">
                    <div className="col-span-3 font-bold uppercase">{product.name}</div>
                    <div className="col-span-1 text-right font-mono">{formatPrice(product.price)}</div>
                    <div className="col-span-1 pl-12 text-neutral-600">{product.published ? 'PUBLISHED' : 'DRAFT'}</div>
                    <div className="col-span-2 text-right">
                        <span className="text-neutral-600">AVAIL</span>{' '}
                        <span className="font-mono  font-bold">{totalAvailable}</span>
                    </div>
                    <div className="col-span-2 text-right">
                        <span className="text-neutral-600">COMM</span>{' '}
                        <span className="font-mono font-bold">{totalCommitted}</span>
                    </div>
                    <div className="col-span-2 text-right">
                        <span className="text-neutral-600">TOTAL</span>{' '}
                        <span className="font-mono font-bold">{totalInventory}</span>
                    </div>
                    <div className="col-span-1 text-right" onClick={(e) => e.preventDefault()}>
                        <ProductActions productId={product.id} />
                    </div>
                </div>
            </Link>

            {/* Sizes Row */}
            <div className="grid grid-cols-12 gap-4 pl-8 text-[8pt]">
                {product.sizes.map((size) => (
                    <div
                        key={size.id}
                        className={`col-span-2 font-mono ${
                            size.available === 0 ? 'text-red-600' : 'text-neutral-600'
                        }`}
                    >
                        <span className="font-bold text-black">{size.size}</span>
                        {' '}
                        {size.available}/{size.committed}/{size.total}
                    </div>
                ))}
            </div>

            {/* Divider */}
            <div className="h-px bg-neutral-200 mt-4" />
        </div>
    )
}