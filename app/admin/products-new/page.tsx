import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { ProductsSidebarView } from '@/components/admin/products-sidebar-view'

export const dynamic = 'force-dynamic'

export default async function AdminProductsNewPage() {
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
            <ProductsSidebarView products={products} />
        </div>
    )
}
