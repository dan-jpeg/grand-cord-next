import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { AdminNav } from '@/components/admin/admin-nav'
import { OrdersTable } from '@/components/admin/orders-table'

export const dynamic = 'force-dynamic'

export default async function AdminOrdersPage() {
    const session = await auth()

    if (!session) {
        redirect('/admin/login')
    }

    const orders = await prisma.order.findMany({
        include: { items: true },
        orderBy: { createdAt: 'desc' },
    })

    return (
        <div className="absolute inset-0 bg-white overflow-auto">
            <AdminNav active="orders" />
            <div className="w-full px-16 py-12">
                <OrdersTable orders={orders} />
            </div>
        </div>
    )
}