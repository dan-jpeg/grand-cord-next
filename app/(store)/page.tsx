import { prisma } from '@/lib/prisma'
import { MobileCatalogShell } from '@/components/store/mobile-catalog-shell'
import { CatalogSection } from '@/components/store/catalog-section'
import { MobileHero } from '@/components/store/mobile-hero'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
    const products = await prisma.product.findMany({
        where: { published: true },
        include: { sizes: true },
        orderBy: { createdAt: 'desc' },
    })

    return (
        <>
            {/* Mobile */}
            <div className="lg:hidden">
                <MobileCatalogShell products={products} />
            </div>
            {/* Desktop View */}
            <div className="hidden lg:block min-h-screen font-inter bg-white">
                <div className="px-[9vw] lg:grid grid-cols-12 pt-[calc(100vh-200px)] gap-y-[260px] w-full">
                    <p className="col-span-9 text-left leading-3 pr-[5rem] font-inter text-[7pt] italic">
                        This catalog is the work of many people; founded as a shared framework for independent studios.
                        Grand-Cord is supported by those involved and takes no commission. All orders are shipped from
                        Chicago.
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
                    <CatalogSection products={products}/>
                </div>
            </div>
        </>
    )
}