import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { ProductRow } from '@/components/admin/product-row'

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
        <div className="absolute inset-0 bg-white p-8 overflow-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-6">
                    <Link href="/admin" className="text-[9pt] font-bold hover:underline">
                        ← BACK
                    </Link>
                    <h1 className="text-[9pt] font-bold uppercase">INVENTORY</h1>
                </div>
                <Link
                    href="/admin/products/new"
                    className="bg-black text-white px-3 py-1 text-[9pt] font-bold uppercase hover:bg-neutral-800"
                >
                    + ADD PRODUCT
                </Link>
            </div>

            {/* Products Table */}
            <div className="space-y-6">
                {products.map((product) => (
                    <ProductRow key={product.id} product={product} />
                ))}
            </div>
        </div>
    )
}