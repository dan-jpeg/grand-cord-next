'use client'

import { useMemo, useState } from 'react'
import { MobileHero } from '@/components/store/mobile-hero'
import { CatalogSection } from '@/components/store/catalog-section'
import { CatalogNavWrapper } from '@/components/store/catalog-nav-wrapper'
import type { Product, ProductSize } from '@prisma/client'
import { matchesProductSearch } from '@/lib/product-search'

type ProductWithSizes = Product & { sizes: ProductSize[] }

type NavConfig = {
    showSearch: boolean
    showSample: boolean
    scrollToTopOnTapMobile: boolean
    scrollToTopOnTapDesktop: boolean
    groups: { id: string; name: string; slug: string }[]
}

export function MobileCatalogShell({
    products,
    navConfig,
}: {
    products: ProductWithSizes[]
    navConfig?: NavConfig
}) {
    const [searchQuery, setSearchQuery] = useState('')
    const [mobileLayout, setMobileLayout] = useState<'1x1' | '2x2' | '3x3'>('1x1')

    const filteredProducts = useMemo(() => {
        if (!searchQuery) return products
        return products.filter((product) => matchesProductSearch(product, searchQuery))
    }, [products, searchQuery])

    return (
        <>
            <MobileHero />
            <CatalogNavWrapper
                productCount={filteredProducts.length}
                onSearchChange={setSearchQuery}
                mobileLayout={mobileLayout}
                onLayoutChange={setMobileLayout}
                navConfig={navConfig}
            />
            <CatalogSection
                products={filteredProducts}
                mobileLayout={mobileLayout}
                productCount={filteredProducts.length}
            />
        </>
    )
}
