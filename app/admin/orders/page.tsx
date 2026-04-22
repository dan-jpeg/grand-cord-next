import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { AdminNav } from '@/components/admin/admin-nav'
import { OrdersTable } from '@/components/admin/orders-table'
import { getPickUrgency } from '@/lib/pick'

export const dynamic = 'force-dynamic'

export default async function AdminOrdersPage() {
    const session = await auth()

    if (!session) {
        redirect('/admin/login')
    }

    const [orders, pickUrgency] = await Promise.all([
        prisma.order.findMany({ include: { items: true }, orderBy: { createdAt: 'desc' } }),
        getPickUrgency(),
    ])

    return (
        <div className="absolute inset-0 bg-white overflow-auto">
            <AdminNav active="orders" variant="centered" pickUrgency={pickUrgency} />
            <div className="w-full px-16 py-12">
                <OrdersTable orders={orders} />
            </div>
        </div>
    )
}