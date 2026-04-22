import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { PickQueue } from '@/components/admin/pick-queue'

export const dynamic = 'force-dynamic'

type ImageData = {
    url: string
    isCartPrimary?: boolean
    isMobilePrimary?: boolean
    isDesktopPrimary?: boolean
}

export type PickOrder = {
    id: string
    orderNumber: string
    createdAt: Date
    itemCount: number
    cartPhotos: string[]
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
        select: { id: true, images: true },
    })

    const cartPhotoMap = new Map(
        products.map(p => {
            const images = (p.images as ImageData[] | null) ?? []
            const url = images.find(img => img.isCartPrimary)?.url
                ?? images.find(img => img.isMobilePrimary)?.url
                ?? images[0]?.url
                ?? null
            return [p.id, url]
        })
    )

    const pickOrders: PickOrder[] = orders.map(order => {
        const uniqueProductIds = [...new Set(order.items.map(i => i.productId))]
        const photos = uniqueProductIds
            .map(id => cartPhotoMap.get(id))
            .filter((url): url is string => !!url)

        return {
            id: order.id,
            orderNumber: order.orderNumber,
            createdAt: order.createdAt,
            itemCount: order.items.reduce((sum, item) => sum + (item.quantity ?? 1), 0),
            cartPhotos: photos,
        }
    })

    return <PickQueue orders={pickOrders} />
}
