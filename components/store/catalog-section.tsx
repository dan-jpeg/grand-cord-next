'use client'

import { useMemo, useState } from 'react'
import { ProductCard } from './product-card'
import { CatalogNav } from './catalog-nav'
import type { Product, ProductSize } from '@prisma/client'
import { matchesProductSearch } from '@/lib/product-search'

type ProductWithSizes = Product & {
    sizes: ProductSize[]
}

type CatalogSectionProps = {
    products: ProductWithSizes[]
    mobileLayout?: '1x1' | '2x2' | '3x3'
    onLayoutChange?: (layout: '1x1' | '2x2' | '3x3') => void
    productCount?: number
}

export function CatalogSection({
                                   products,
                                   mobileLayout = '1x1',
                                   onLayoutChange,
                                   productCount
                               }: CatalogSectionProps) {
    const [searchQuery, setSearchQuery] = useState('')

    const filteredProducts = useMemo(() => {
        if (!searchQuery.trim()) return products

        return products.filter((product) => matchesProductSearch(product, searchQuery))
    }, [products, searchQuery])

    const gridClasses = useMemo(() => {
        if (mobileLayout === '3x3') {
            return 'grid-cols-3 md:grid-cols-3 lg:grid-cols-3'
        }
        if (mobileLayout === '2x2') {
            return 'grid-cols-2 md:grid-cols-2 lg:grid-cols-3'
        }
        return 'grid-cols-1 md:grid-cols-1 lg:grid-cols-3'
    }, [mobileLayout])

    return (
        <section id="catalog" className="py-24 ">
            {/* Only show CatalogNav on desktop */}
            <div className="hidden lg:block sticky top-0 z-50">
                <CatalogNav
                    productCount={productCount ?? products.length}
                    onSearchChange={setSearchQuery}
                    mobileLayout={mobileLayout}
                    onLayoutChange={onLayoutChange}
                />
            </div>

            {filteredProducts.length === 0 ? (
                <div className="min-h-[60vh] flex items-center justify-center">
                    <p className="text-[9pt] text-neutral-400">No results found</p>
                </div>
            ) : (
                <>
                    <div className={`grid gap-x-1.5 gap-y-16 pb-0 ${gridClasses}`}>
                        {filteredProducts.map((product, index) => (
                            <ProductCard
                                key={product.id}
                                product={product}
                                index={index}
                                compact={mobileLayout === '2x2' || mobileLayout === '3x3'}
                                cols={mobileLayout === '3x3' ? 3 : mobileLayout === '2x2' ? 2 : 1}
                            />
                        ))}
                    </div>
                    <div className={`grid gap-x-1.5 gap-y-16 pb-0 ${gridClasses}`}>
                        {filteredProducts.map((product, index) => (
                            <ProductCard
                                key={product.id}
                                product={product}
                                index={index}
                                compact={mobileLayout === '2x2' || mobileLayout === '3x3'}
                                cols={mobileLayout === '3x3' ? 3 : mobileLayout === '2x2' ? 2 : 1}
                            />
                        ))}
                    </div>
                    <div className={`grid gap-x-1.5 gap-y-16 pb-0 ${gridClasses}`}>
                        {filteredProducts.map((product, index) => (
                            <ProductCard
                                key={product.id}
                                product={product}
                                index={index}
                                compact={mobileLayout === '2x2' || mobileLayout === '3x3'}
                                cols={mobileLayout === '3x3' ? 3 : mobileLayout === '2x2' ? 2 : 1}
                            />
                        ))}
                    </div>
                    <div className={`grid gap-x-1.5 gap-y-16 pb-0 ${gridClasses}`}>
                        {filteredProducts.map((product, index) => (
                            <ProductCard
                                key={product.id}
                                product={product}
                                index={index}
                                compact={mobileLayout === '2x2' || mobileLayout === '3x3'}
                                cols={mobileLayout === '3x3' ? 3 : mobileLayout === '2x2' ? 2 : 1}
                            />
                        ))}
                    </div>
                </>
            )}
        </section>
    )
}
