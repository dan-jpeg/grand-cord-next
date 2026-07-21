import { Navigation } from '@/components/store/navigation'
import { GlobalCatalogNav } from '@/components/store/global-catalog-nav'
import { ScrollToHash } from '@/components/store/scroll-to-hash'
import { prisma } from '@/lib/prisma'

export default async function StoreLayout({
                                        children,
                                    }: {
    children: React.ReactNode
}) {
    const [productCount, settings, navGroups] = await Promise.all([
        prisma.product.count({ where: { published: true } }),
        prisma.siteSettings.upsert({
            where: { id: 'default' },
            create: { id: 'default' },
            update: {},
            select: {
                showSearchInNav: true,
                showSampleInNav: true,
                scrollToTopOnCatalogTapMobile: true,
                scrollToTopOnCatalogTapDesktop: true,
            },
        }),
        prisma.collection.findMany({
            where: { showInCatalog: true },
            orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
            select: { id: true, name: true, slug: true },
        }),
    ])

    const navConfig = {
        showSearch: settings.showSearchInNav,
        showSample: settings.showSampleInNav,
        scrollToTopOnTapMobile: settings.scrollToTopOnCatalogTapMobile,
        scrollToTopOnTapDesktop: settings.scrollToTopOnCatalogTapDesktop,
        groups: navGroups,
    }

    return (
        <>
            <Navigation />
            <GlobalCatalogNav productCount={productCount} navConfig={navConfig} />
            <ScrollToHash />
            <main className="">
                {children}
            </main>
        </>
    )
}