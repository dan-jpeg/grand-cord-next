import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { ProductsSplitView } from '@/components/admin/products-split-view'

export const dynamic = 'force-dynamic'

export default async function AdminProductsSplitPage() {
    const session = await auth()
    if (!session) {
        redirect('/admin/login')
    }

    const products = await prisma.product.findMany({
        include: { sizes: true },
        orderBy: { createdAt: 'desc' },
    })

    return (
        <div className="absolute inset-0 bg-white overflow-hidden">
            <ProductsSplitView products={products} />
        </div>
    )
}
