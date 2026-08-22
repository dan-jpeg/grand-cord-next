import { prisma } from '@/lib/prisma'
import { MobileCatalogShell } from '@/components/store/mobile-catalog-shell'
import { CatalogSection } from '@/components/store/catalog-section'
import { MobileHero } from '@/components/store/mobile-hero'
import { DEFAULT_WELCOME_MESSAGE } from '@/lib/site-settings'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
    const [products, settings, navGroups] = await Promise.all([
        prisma.product.findMany({
            where: { published: true },
            include: { sizes: true },
            orderBy: { createdAt: 'desc' },
        }),
        prisma.siteSettings.upsert({
            where: { id: 'default' },
            create: { id: 'default' },
            update: {},
            select: {
                showSearchInNav: true,
                showSampleInNav: true,
                scrollToTopOnCatalogTapMobile: true,
                scrollToTopOnCatalogTapDesktop: true,
                welcomeMessage: true,
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

    const welcomeMessage = settings.welcomeMessage?.trim() || DEFAULT_WELCOME_MESSAGE

    return (
        <>
            {/* Mobile */}
            <div className="lg:hidden">
                <MobileCatalogShell
                    products={products}
                    navConfig={navConfig}
                    welcomeMessage={welcomeMessage}
                />
            </div>
            {/* Desktop View */}
            <div className="hidden lg:block min-h-[calc(100*var(--vh))]  font-inter bg-white">
                <div className="pl-[calc(5*var(--vw))]  pr-[calc(6*var(--vw))] mb-32  px-2 lg:grid grid-cols-12 pt-[calc(100*var(--vh)-200px)] gap-y-[200px] w-full">
                    <p className="col-span-9 text-left leading-3 pr-[5rem] font-inter text-[7pt] italic">
                        {welcomeMessage}
                    </p>
                    <div className="col-span-1"></div>
                    <p className="text-[9.5pt] col-span-1 text-right font-semibold italic whitespace-nowrap">Grand-Cord</p>
                    <div className="col-span-1"></div>

                    <div className="block md:col-span-2   lg:col-span-1">
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

                <div className="pt-20 pb-12">
                    <CatalogSection products={products} navConfig={navConfig} desktopAnchorId="catalog-desktop" />
                </div>
            </div>
        </>
    )
}