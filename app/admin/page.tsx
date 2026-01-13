import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { AdminNav } from "@/components/admin/admin-nav"
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function AdminDashboard() {
    const session = await auth()

    if (!session) {
        redirect('/admin/login')
    }

    const ordersCount = await prisma.order.count({ where: { status: 'PAID' } })

    return (
        <>
            <div className="absolute inset-0 bg-white overflow-auto">
                <AdminNav active="more" />
            </div>
        </>
    )
}