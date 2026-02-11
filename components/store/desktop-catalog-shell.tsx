'use client'

import { useMemo, useState } from 'react'
import { CatalogNav } from '@/components/store/catalog-nav'
import { CatalogSection } from '@/components/store/catalog-section'
import type { Product, ProductSize } from '@prisma/client'
import { matchesProductSearch } from '@/lib/product-search'

type ProductWithSizes = Product & { sizes: ProductSize[] }

export function DesktopCatalogShell({ products }: { products: ProductWithSizes[] }) {
    const [searchQuery, setSearchQuery] = useState('')
    const [mobileLayout, setMobileLayout] = useState<'1x1' | '2x2' | '3x3'>('1x1')

    const filteredProducts = useMemo(() => {
        if (!searchQuery) return products
        return products.filter((product) => matchesProductSearch(product, searchQuery))
    }, [products, searchQuery])

    return (
        <div className="min-h-screen font-inter bg-white">
            <div className="px-[9vw] lg:grid grid-cols-12 pt-[calc(100vh-200px)] gap-y-[260px] w-full">
                <p className="col-span-9 text-left leading-3 pr-[5rem] font-inter text-[7pt] italic">
                    This catalog is the work of many people; founded as a shared framework for independent studios.
                    Grand-Cord is supported by those involved and takes no commission. All orders are shipped from Chicago.
                </p>
                <div className="col-span-1"></div>
                <p className="text-[9.5pt] col-span-1 text-right font-semibold italic whitespace-nowrap">Grand-Cord</p>
                <div className="col-span-1"></div>

                <div className="block md:col-span-2 lg:col-span-1">
                    <div className="whitespace-nowrap text-[8pt] font-semibold italic opacity-60 mb-2">
                        messenger @ grand-cord.com
                    </div>
                    <div className="grid w-[112px] tracking-[1.0] gap-x-0 grid-cols-2 text-[8pt] opacity-90">
                        <div className="col-span-2">4200 W Grand Ave</div>
                        <div className="col-span-1 whitespace-nowrap text-left">Chicago IL</div>
                        <div className="col-span-1 text-right">60651</div>
                    </div>
                </div>
            </div>

            <div className="pt-20">
                <div className="hidden lg:block sticky top-0 z-50">
                    <CatalogNav
                        productCount={filteredProducts.length}
                        onSearchChange={setSearchQuery}
                        mobileLayout={mobileLayout}
                        onLayoutChange={setMobileLayout}
                    />
                </div>

                <CatalogSection
                    products={filteredProducts}
                    mobileLayout={mobileLayout}
                />
            </div>
        </div>
    )
}
