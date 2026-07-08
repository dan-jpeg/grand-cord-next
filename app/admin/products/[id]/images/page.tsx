import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect, notFound } from 'next/navigation'
import { AdminNav } from '@/components/admin/admin-nav'
import { ProductImagesView } from '@/components/admin/product-images-view'
import { getPickUrgency } from '@/lib/pick'
import type { ImageRecord } from './actions'

export const dynamic = 'force-dynamic'

export default async function ProductImagesPage({
    params,
}: {
    params: Promise<{ id: string }>
}) {
    const session = await auth()
    if (!session) redirect('/admin/login')

    const { id } = await params

    const [product, pickUrgency] = await Promise.all([
        prisma.product.findUnique({
            where: { id },
            select: { id: true, name: true, slug: true, images: true },
        }),
        getPickUrgency(),
    ])

    if (!product) notFound()

    const rawImages = Array.isArray(product.images) ? product.images : []
    const images: ImageRecord[] = rawImages.map((img, index) => {
        const image = img as unknown as Partial<ImageRecord>
        return {
            url: image.url ?? '',
            isMobilePrimary: image.isMobilePrimary ?? index === 0,
            isDesktopPrimary: image.isDesktopPrimary ?? index === 0,
            isCartPrimary: image.isCartPrimary ?? index === 0,
            isGrid1x1Primary: image.isGrid1x1Primary ?? index === 0,
            isGrid2x2Primary: image.isGrid2x2Primary ?? index === 0,
            isGrid3x3Primary: image.isGrid3x3Primary ?? index === 0,
            showOnPdp: image.showOnPdp ?? true,
        }
    })

    return (
        <div className="absolute inset-0 bg-white overflow-hidden">
            <AdminNav active="inventory" variant="centered" pickUrgency={pickUrgency} />
            <ProductImagesView
                product={{ id: product.id, name: product.name, slug: product.slug }}
                initialImages={images}
            />
        </div>
    )
}
