'use client'

import { useMemo, useState } from 'react'
import { ProductCard } from './product-card'
import { CatalogNav } from './catalog-nav'
import type { Product, ProductSize } from '@prisma/client'
import { matchesProductSearch } from '@/lib/product-search'

type ProductWithSizes = Product & {
    sizes: ProductSize[]
}

type NavConfig = {
    showSearch: boolean
    showSample: boolean
    scrollToTopOnTapMobile: boolean
    scrollToTopOnTapDesktop: boolean
    groups: { id: string; name: string; slug: string }[]
}

type CatalogSectionProps = {
    products: ProductWithSizes[]
    mobileLayout?: '1x1' | '2x2' | '3x3'
    onLayoutChange?: (layout: '1x1' | '2x2' | '3x3') => void
    productCount?: number
    navConfig?: NavConfig
}

export function CatalogSection({
                                   products,
                                   mobileLayout = '1x1',
                                   onLayoutChange,
                                   productCount,
                                   navConfig,
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
            {/* Non-sticky marker for scroll-to-top targeting. The nav below is
                position: sticky, so once it's pinned its own rect always
                reads top:0 and scrollIntoView on it becomes a no-op. */}
            <div data-catalog-scroll-anchor className="hidden lg:block h-0" />
            {/* Only show CatalogNav on desktop */}
            <div className="hidden lg:block sticky top-0 z-50">
                <CatalogNav
                    productCount={productCount ?? products.length}
                    onSearchChange={setSearchQuery}
                    mobileLayout={mobileLayout}
                    onLayoutChange={onLayoutChange}
                    navConfig={navConfig}
                />
            </div>

            {filteredProducts.length === 0 ? (
                <div className="min-h-[60vh] flex items-center justify-center">
                    <p className="text-[9pt] text-neutral-400">No results found</p>
                </div>
            ) : (
                <>
                    <div className={`grid gap-x-[1.5vw] lg:gap-x-2 gap-y-0 pb-0 ${gridClasses}`}>
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
                    <div className={`grid gap-x-[1.5vw] lg:gap-x-2 gap-y-0 pb-0 ${gridClasses}`}>
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
