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

    const [orders, pickUrgency, products] = await Promise.all([
        prisma.order.findMany({ include: { items: true }, orderBy: { createdAt: 'desc' } }),
        getPickUrgency(),
        prisma.product.findMany({ select: { id: true, images: true } }),
    ])

    // productId -> best thumbnail (inventory shot preferred) for the mobile
    // orders list's expandable image rows.
    const productImages: Record<string, string> = {}
    for (const p of products) {
        const imgs = Array.isArray(p.images) ? (p.images as { url?: string; isInventoryPrimary?: boolean; isCartPrimary?: boolean }[]) : []
        const url =
            imgs.find((i) => i?.isInventoryPrimary)?.url ??
            imgs.find((i) => i?.isCartPrimary)?.url ??
            imgs[0]?.url
        if (url) productImages[p.id] = url
    }

    return (
        <div className="absolute inset-0 bg-white overflow-auto">
            <AdminNav active="orders" variant="centered" mobileLabel="Orders" pickUrgency={pickUrgency} />
            <div className="w-full px-3 pb-6 lg:px-16 lg:py-12">
                <OrdersTable orders={orders} productImages={productImages} />
            </div>
        </div>
    )
}