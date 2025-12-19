import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'



export default async function AdminDashboard() {

    const session = await auth()

    if (!session) {
        redirect('/admin/login')
    }

    const [productCount, orderCount, paidOrders] = await Promise.all([
        prisma.product.count(),
        prisma.order.count(),
        prisma.order.count({ where: { status: 'PAID' } }),
    ])

    return (
        <div className="max-w-7xl mx-auto px-6 py-8">
            <h2 className="text-2xl font-bold mb-8">Dashboard</h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                <div className="bg-white p-6 border border-neutral-200">
                    <div className="text-sm text-neutral-600 mb-2">Products</div>
                    <div className="text-3xl font-bold">{productCount}</div>
                </div>

                <div className="bg-white p-6 border border-neutral-200">
                    <div className="text-sm text-neutral-600 mb-2">Orders to Fulfill</div>
                    <div className="text-3xl font-bold">{paidOrders}</div>
                </div>

                <div className="bg-white p-6 border border-neutral-200">
                    <div className="text-sm text-neutral-600 mb-2">Total Orders</div>
                    <div className="text-3xl font-bold">{orderCount}</div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Link
                    href="/admin/products"
                    className="bg-white p-6 border border-neutral-200 hover:border-black transition-colors"
                >
                    <h3 className="font-bold mb-2">Products</h3>
                    <p className="text-sm text-neutral-600">Manage your product catalog</p>
                </Link>

                <Link
                    href="/admin/orders"
                    className="bg-white p-6 border border-neutral-200 hover:border-black transition-colors"
                >
                    <h3 className="font-bold mb-2">Orders</h3>
                    <p className="text-sm text-neutral-600">View and fulfill orders</p>
                </Link>

                <Link
                    href="/admin/collections"
                    className="bg-white p-6 border border-neutral-200 hover:border-black transition-colors"
                >
                    <h3 className="font-bold mb-2">Collections</h3>
                    <p className="text-sm text-neutral-600">Organize products</p>
                </Link>

                <Link
                    href="/admin/blog"
                    className="bg-white p-6 border border-neutral-200 hover:border-black transition-colors"
                >
                    <h3 className="font-bold mb-2">Blog</h3>
                    <p className="text-sm text-neutral-600">Manage blog posts</p>
                </Link>
            </div>
        </div>
    )
}