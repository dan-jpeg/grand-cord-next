import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { AdminNav } from "@/components/admin/admin-nav"
import { getPickUrgency } from '@/lib/pick'

export const dynamic = 'force-dynamic'

export default async function AdminDashboard() {
    const session = await auth()

    if (!session) {
        redirect('/admin/login')
    }

    const [ordersCount, pickUrgency] = await Promise.all([
        prisma.order.count({ where: { status: 'PAID' } }),
        getPickUrgency(),
    ])

    return (
        <div className="min-h-[calc(100*var(--vh))] bg-white relative">
            <AdminNav active="more" variant="top-left" mobileVariant="hub" pickUrgency={pickUrgency} />
        </div>
    )
}