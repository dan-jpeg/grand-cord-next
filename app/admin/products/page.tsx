import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { AdminNav } from "@/components/admin/admin-nav"
import { ProductsTable } from '@/components/admin/products-table'

export const dynamic = 'force-dynamic'

export default async function AdminProductsPage() {
    const session = await auth()

    if (!session) {
        redirect('/admin/login')
    }

    const products = await prisma.product.findMany({
        include: { sizes: true },
        orderBy: { createdAt: 'desc' },
    })

    return (
        <div className="absolute inset-0 bg-white overflow-auto">
            <AdminNav active="inventory" />
            <div className="w-full px-16 py-12">
                <ProductsTable products={products} />
            </div>
        </div>
    )
}