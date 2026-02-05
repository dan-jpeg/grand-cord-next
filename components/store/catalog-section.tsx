'use client'

import { useMemo } from 'react'
import { ProductCard } from './product-card'
import { CatalogNav } from './catalog-nav'
import type { Product, ProductSize } from '@prisma/client'

type ProductWithSizes = Product & {
    sizes: ProductSize[]
}

type CatalogSectionProps = {
    products: ProductWithSizes[]
    mobileLayout?: '1x1' | '2x2' | '3x3'
    onSearchChange?: (query: string) => void
    onLayoutChange?: (layout: '1x1' | '2x2' | '3x3') => void
    productCount?: number
}

export function CatalogSection({
                                   products,
                                   mobileLayout = '1x1',
                                   onSearchChange,
                                   onLayoutChange,
                                   productCount
                               }: CatalogSectionProps) {
    const gridClasses = useMemo(() => {
        if (mobileLayout === '3x3') {
            return 'grid-cols-3 md:grid-cols-3 px-2 lg:grid-cols-3'
        }
        if (mobileLayout === '2x2') {
            return 'grid-cols-2 md:grid-cols-2 px-2 lg:grid-cols-3'
        }
        return 'grid-cols-1 md:grid-cols-1 px-2 lg:grid-cols-3'
    }, [mobileLayout])

    return (
        <section id="catalog" className="py-24">
            {/* Only show CatalogNav on desktop */}
            <div className="hidden lg:block sticky top-0 z-50">
                <CatalogNav
                    productCount={productCount ?? products.length}
                    onSearchChange={onSearchChange}
                    mobileLayout={mobileLayout}
                    onLayoutChange={onLayoutChange}
                />
            </div>

        

            {products.length === 0 ? (
                <div className="min-h-[60vh] flex items-center justify-center">
                    <p className="text-[9pt] text-neutral-400">No results found</p>
                </div>
            ) : (
                <>
                    <div className={`grid gap-x-1.5 gap-y-16 pb-0 ${gridClasses}`}>
                        {products.map((product, index) => (
                            <ProductCard
                                key={product.id}
                                product={product}
                                index={index}
                                compact={mobileLayout === '2x2' || mobileLayout === '3x3'}
                            />
                        ))}
                    </div>
                    <div className={`grid gap-x-1.5 gap-y-16 pb-0 ${gridClasses}`}>
                        {products.map((product, index) => (
                            <ProductCard
                                key={product.id}
                                product={product}
                                index={index}
                                compact={mobileLayout === '2x2' || mobileLayout === '3x3'}
                            />
                        ))}
                    </div>
                    <div className={`grid gap-x-1.5 gap-y-16 pb-0 ${gridClasses}`}>
                        {products.map((product, index) => (
                            <ProductCard
                                key={product.id}
                                product={product}
                                index={index}
                                compact={mobileLayout === '2x2' || mobileLayout === '3x3'}
                            />
                        ))}
                    </div>
                    <div className={`grid gap-x-1.5 gap-y-16 pb-0 ${gridClasses}`}>
                        {products.map((product, index) => (
                            <ProductCard
                                key={product.id}
                                product={product}
                                index={index}
                                compact={mobileLayout === '2x2' || mobileLayout === '3x3'}
                            />
                        ))}
                    </div>
                </>
            )}
        </section>
    )
}
