'use client'

import { usePathname } from 'next/navigation'
import { CatalogNav } from './catalog-nav'

type NavConfig = {
    showSearch: boolean
    showSample: boolean
    scrollToTopOnTapMobile: boolean
    scrollToTopOnTapDesktop: boolean
    groups: { id: string; name: string; slug: string }[]
}

// Desktop-only sticky CatalogNav rendered above every store page except the
// home page (where CatalogSection renders its own inline nav after the hero).
export function GlobalCatalogNav({
    productCount,
    navConfig,
}: {
    productCount: number
    navConfig: NavConfig
}) {
    const pathname = usePathname()
    if (pathname === '/') return null
    // PDPs render their own top-left "Catalog" link inside the product header,
    // so the global nav doesn't render there.
    if (pathname.startsWith('/products/')) return null
    // The cart has its own "Return to catalog" link, so no global nav there.
    if (pathname.startsWith('/cart')) return null

    return (
        <div className="hidden lg:block sticky top-0 z-50 bg-white">
            <CatalogNav
                productCount={productCount}
                navConfig={navConfig}
                catalogHomeHref="/#catalog-desktop"
            />
        </div>
    )
}
