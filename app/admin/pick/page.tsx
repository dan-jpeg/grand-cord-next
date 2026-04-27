import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { PickFlow, type FlowOrder } from '@/components/admin/pick-flow'

export const dynamic = 'force-dynamic'

type ImageData = {
    url: string
    isCartPrimary?: boolean
    isMobilePrimary?: boolean
    isDesktopPrimary?: boolean
}

export default async function AdminPickPage() {
    const session = await auth()
    if (!session) redirect('/admin/login')

    const orders = await prisma.order.findMany({
        where: { status: 'PAID' },
        include: { items: true },
        orderBy: { createdAt: 'asc' },
    })

    const productIds = [...new Set(orders.flatMap(o => o.items.map(i => i.productId)))]
    const products = await prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, images: true, color: true, colorHex: true },
    })

    const productInfoMap = new Map(
        products.map(p => {
            const images = (p.images as ImageData[] | null) ?? []
            const url = images.find(img => img.isCartPrimary)?.url
                ?? images.find(img => img.isMobilePrimary)?.url
                ?? images[0]?.url
                ?? null
            return [p.id, { cartPhoto: url, color: p.color, colorHex: p.colorHex }]
        })
    )

    const flowOrders: FlowOrder[] = orders.map(order => ({
        id: order.id,
        orderNumber: order.orderNumber,
        createdAt: order.createdAt,
        email: order.email,
        shippingAddress: (order.shippingAddress as Record<string, string>) ?? {},
        items: order.items.map(item => {
            const info = productInfoMap.get(item.productId)
            return {
                productId: item.productId,
                productName: item.productName,
                size: item.size,
                quantity: item.quantity,
                price: item.price,
                cartPhoto: info?.cartPhoto ?? null,
                color: info?.color ?? null,
                colorHex: info?.colorHex ?? null,
            }
        }),
    }))

    return <PickFlow orders={flowOrders} />
}
