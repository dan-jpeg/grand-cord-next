import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { AdminNav } from '@/components/admin/admin-nav'
import { ManageCatalogView } from '@/components/admin/manage-catalog-view'
import { getPickUrgency } from '@/lib/pick'

export const dynamic = 'force-dynamic'

export default async function AdminManageCatalogPage() {
    const session = await auth()
    if (!session?.user) {
        redirect('/admin/login')
    }

    const [groups, products, settings, sizingAttributes, pickUrgency] = await Promise.all([
        prisma.collection.findMany({
            orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
            include: {
                products: {
                    orderBy: { order: 'asc' },
                    include: { product: { select: { id: true, name: true, slug: true } } },
                },
            },
        }),
        prisma.product.findMany({
            orderBy: { name: 'asc' },
            select: { id: true, name: true, slug: true },
        }),
        prisma.siteSettings.upsert({
            where: { id: 'default' },
            create: { id: 'default' },
            update: {},
        }),
        prisma.sizingAttribute.findMany({
            orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
        }),
        getPickUrgency(),
    ])

    return (
        <div className="absolute inset-0 bg-white overflow-auto">
            <AdminNav active="manage-catalog" variant="centered" pickUrgency={pickUrgency} />
            <div className="w-full px-8 md:px-16 pt-16 pb-12">
                <ManageCatalogView
                    groups={groups.map((g) => ({
                        id: g.id,
                        name: g.name,
                        description: g.description,
                        showInCatalog: g.showInCatalog,
                        showInSample: g.showInSample,
                        showInSearch: g.showInSearch,
                        products: g.products.map((p) => ({
                            id: p.product.id,
                            name: p.product.name,
                            slug: p.product.slug,
                        })),
                    }))}
                    allProducts={products}
                    settings={{
                        showSearchInNav: settings.showSearchInNav,
                        showSampleInNav: settings.showSampleInNav,
                        scrollToTopOnCatalogTapMobile: settings.scrollToTopOnCatalogTapMobile,
                        scrollToTopOnCatalogTapDesktop: settings.scrollToTopOnCatalogTapDesktop,
                    }}
                    sizingAttributes={sizingAttributes.map((a) => ({
                        id: a.id,
                        title: a.title,
                        description: a.description,
                        category: a.category,
                        enabled: a.enabled,
                    }))}
                />
            </div>
        </div>
    )
}
