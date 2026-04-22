import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { AdminNav } from "@/components/admin/admin-nav"
import { ProductsTable } from '@/components/admin/products-table'
import { getPickUrgency } from '@/lib/pick'

export const dynamic = 'force-dynamic'

export default async function AdminProductsPage() {
    const session = await auth()

    if (!session) {
        redirect('/admin/login')
    }

    const [products, pickUrgency] = await Promise.all([
        prisma.product.findMany({ include: { sizes: true }, orderBy: { createdAt: 'desc' } }),
        getPickUrgency(),
    ])

    return (
        <div className="absolute inset-0 bg-white overflow-auto">
            <AdminNav active="inventory" variant="centered" pickUrgency={pickUrgency} />
            <div className="w-full px-16 py-12">
                <ProductsTable products={products} />
            </div>
        </div>
    )
}