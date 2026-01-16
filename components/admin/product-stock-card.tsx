import Link from 'next/link'
import { STOCK_COLORS, STOCK_THRESHOLDS } from '@/lib/constants'
import type { Product, ProductSize } from '@prisma/client'

type ProductWithSizes = Product & {
    sizes: ProductSize[]
}

function getStockStatus(product: ProductWithSizes) {
    const totalAvailable = product.sizes.reduce((sum, s) => sum + s.available, 0)

    if (!product.published) return 'UNPUBLISHED'
    if (totalAvailable === 0) return 'NO_STOCK'
    if (totalAvailable <= STOCK_THRESHOLDS.LOW_STOCK) return 'LOW_STOCK'
    return 'IN_STOCK'
}

function getStockColor(status: string) {
    switch (status) {
        case 'IN_STOCK': return STOCK_COLORS.IN_STOCK
        case 'LOW_STOCK': return STOCK_COLORS.LOW_STOCK
        case 'NO_STOCK': return STOCK_COLORS.NO_STOCK
        case 'UNPUBLISHED': return STOCK_COLORS.UNPUBLISHED
        default: return STOCK_COLORS.UNPUBLISHED
    }
}

export function ProductStockCard({ product }: { product: ProductWithSizes }) {
    const totalAvailable = product.sizes.reduce((sum, s) => sum + s.available, 0)
    const totalCommitted = product.sizes.reduce((sum, s) => sum + s.committed, 0)
    const totalStock = totalAvailable + totalCommitted
    const status = getStockStatus(product)
    const color = getStockColor(status)

    const sortedSizes = [...product.sizes].sort((a, b) => {
        const order = ['XS', 'S', 'M', 'L', 'XL', 'XXL']
        return order.indexOf(a.size) - order.indexOf(b.size)
    })

    return (
        <Link href={`/admin/products/${product.id}/edit`}>
            <div className="p-1 max-w-[450px] hover:bg-neutral-50 transition-colors">
                <div className="flex gap-1">
                    {/* Left column: title above color */}
                    <div className="flex flex-col items-center w-[30px]">
                        <span className="text-[8pt] font-bold uppercase mb-1">
                            {product.name}
                        </span>
                        <div
                            className="w-[30px] h-[30px]"
                            style={{
                                backgroundColor: color,
                                border: status === 'UNPUBLISHED' ? '2px solid black' : 'none',
                            }}
                        />
                    </div>

                    {/* Right column */}
                    <div className="flex-1">
                        {/* Meta row */}
                        <div className="flex items-center text-[8pt] font-bold uppercase">
                            <span>STOCK: {totalStock}</span>
                            <span className="ml-auto italic font-normal">
                                ({totalAvailable} AVAILABLE, {totalCommitted} COMMITTED)
                            </span>
                        </div>

                        {/* Sizes */}
                        <div className="mt-2 border-2 border-black  py-0">
                            <div className="flex justify-between text-[8pt] font-mono">
                                {sortedSizes.map((size) => (
                                    <div
                                        key={size.id}
                                        className="flex gap-1 flex-1 justify-center"
                                    >
                                        <span className="font-bold">{size.size}:</span>
                                        <span>{size.total}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </Link>
    )
}