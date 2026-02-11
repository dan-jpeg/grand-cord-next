'use client'

import { useMemo, useState } from 'react'
import { MobileHero } from '@/components/store/mobile-hero'
import { CatalogSection } from '@/components/store/catalog-section'
import { CatalogNavWrapper } from '@/components/store/catalog-nav-wrapper'
import type { Product, ProductSize } from '@prisma/client'

type ProductWithSizes = Product & { sizes: ProductSize[] }

export function MobileCatalogShell({ products }: { products: ProductWithSizes[] }) {
    const [searchQuery, setSearchQuery] = useState('')
    const [mobileLayout, setMobileLayout] = useState<'1x1' | '2x2' | '3x3'>('1x1')

    const filteredProducts = useMemo(() => {
        if (!searchQuery) return products
        const q = searchQuery.toLowerCase()
        return products.filter(p =>
            p.name.toLowerCase().includes(q) ||
            p.designerNames.some((designer) => designer.toLowerCase().includes(q)) ||
            p.color?.toLowerCase().includes(q) ||
            p.material?.toLowerCase().includes(q)
        )
    }, [products, searchQuery])

    return (
        <>
            <MobileHero />
            <CatalogNavWrapper
                productCount={filteredProducts.length}
                onSearchChange={setSearchQuery}
                mobileLayout={mobileLayout}
                onLayoutChange={setMobileLayout}
            />
            <CatalogSection
                products={filteredProducts}
                mobileLayout={mobileLayout}
                productCount={filteredProducts.length}
            />
        </>
    )
}
