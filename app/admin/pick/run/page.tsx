import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { PickRun, type PickTask, type ShipOrder } from '@/components/admin/pick-run'

export const dynamic = 'force-dynamic'

type ImageData = {
    url: string
    isCartPrimary?: boolean
    isMobilePrimary?: boolean
}

export default async function PickRunPage({
    searchParams,
}: {
    searchParams: Promise<{ orders?: string; mode?: string }>
}) {
    const session = await auth()
    if (!session) redirect('/admin/login')

    const { orders: orderParam, mode } = await searchParams
    if (!orderParam) redirect('/admin/pick')

    const orderIds = orderParam.split(',').filter(Boolean)
    if (orderIds.length === 0) redirect('/admin/pick')

    const orders = await prisma.order.findMany({
        where: { id: { in: orderIds } },
        include: { items: true },
        orderBy: { createdAt: 'asc' },
    })

    if (orders.length === 0) redirect('/admin/pick')

    const productIds = [...new Set(orders.flatMap(o => o.items.map(i => i.productId)))]
    const products = await prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, images: true },
    })

    const cartPhotoMap = new Map(
        products.map(p => {
            const images = (p.images as ImageData[] | null) ?? []
            const url =
                images.find(img => img.isCartPrimary)?.url ??
                images.find(img => img.isMobilePrimary)?.url ??
                images[0]?.url ??
                null
            return [p.id, url]
        })
    )

    let tasks: PickTask[]

    if (mode === 'batch') {
        const grouped = new Map<string, PickTask>()
        for (const order of orders) {
            for (const item of order.items) {
                const existing = grouped.get(item.productId)
                const detail = {
                    orderId: order.id,
                    orderLabel: order.orderNumber.slice(0, 3),
                    email: order.email,
                    size: item.size,
                    quantity: item.quantity,
                    price: item.price,
                }
                if (existing) {
                    existing.details.push(detail)
                } else {
                    grouped.set(item.productId, {
                        cartPhoto: cartPhotoMap.get(item.productId) ?? null,
                        productName: item.productName,
                        details: [detail],
                    })
                }
            }
        }
        tasks = [...grouped.values()]
    } else {
        tasks = orders.flatMap(order =>
            order.items.map(item => ({
                cartPhoto: cartPhotoMap.get(item.productId) ?? null,
                productName: item.productName,
                details: [{
                    orderId: order.id,
                    orderLabel: order.orderNumber.slice(0, 3),
                    email: order.email,
                    size: item.size,
                    quantity: item.quantity,
                    price: item.price,
                }],
            }))
        )
    }

    const shipOrders: ShipOrder[] = orders.map(order => {
        const addr = order.shippingAddress as Record<string, string>
        return {
            id: order.id,
            orderNumber: order.orderNumber,
            recipientName: addr.name ?? '',
            address: addr.address ?? '',
            city: addr.city ?? '',
            state: addr.state ?? '',
            zip: addr.zip ?? '',
            country: addr.country ?? '',
            email: order.email,
            items: order.items.map(item => ({
                productName: item.productName,
                size: item.size,
                quantity: item.quantity,
                cartPhoto: cartPhotoMap.get(item.productId) ?? null,
            })),
        }
    })

    return <PickRun tasks={tasks} shipOrders={shipOrders} />
}
