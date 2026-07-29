import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import { ProductDetailMobile } from '@/components/admin/product-detail-mobile'
import type { Tab } from '@/components/admin/product-form'

const VALID_TABS: Tab[] = ['identity', 'look', 'sizing', 'listing', 'sales', 'history']

export default async function ProductDetailPage({
                                                    params,
                                                    searchParams,
                                                }: {
    params: Promise<{ id: string }>
    searchParams: Promise<{ tab?: string }>
}) {
    const session = await auth()
    if (!session) {
        redirect('/admin/login')
    }

    const { id } = await params
    const { tab } = await searchParams
    const initialTab = VALID_TABS.find((t) => t === tab)

    const product = await prisma.product.findUnique({
        where: { id },
        include: {
            sizes: true,
        },
    })

    if (!product) {
        notFound()
    }

    return (
        <div className="absolute inset-0 bg-white overflow-auto">
            {/* Mobile two-state listing interface (Figma), rendered at all
                sizes for now — desktop editor removed. */}
            <ProductDetailMobile product={product} initialTab={initialTab} />
        </div>
    )
}