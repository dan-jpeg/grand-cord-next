import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { OrdersList } from '@/components/admin/orders-list'

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
        <div className="absolute inset-0 bg-white p-8 overflow-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-8 pb-4 border-b border-black">
                <div className="flex items-center gap-4">
                    <Link href="/admin" className="text-[9pt] font-bold hover:underline">
                        ← BACK
                    </Link>
                    <h1 className="text-[9pt] font-bold uppercase">ORDERS</h1>
                </div>
            </div>

            <OrdersList orders={orders} />
        </div>
    )
}