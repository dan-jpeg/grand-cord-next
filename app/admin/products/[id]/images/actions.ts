'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

export type ImageRecord = {
    url: string
    isMobilePrimary: boolean
    isDesktopPrimary: boolean
    isCartPrimary: boolean
    isGrid1x1Primary: boolean
    isGrid2x2Primary: boolean
    isGrid3x3Primary: boolean
    showOnPdp: boolean
}

function revalidate(productId: string, slug: string) {
    revalidatePath(`/admin/products/${productId}/images`)
    revalidatePath(`/admin/products/${productId}/edit`)
    revalidatePath('/admin/products')
    revalidatePath(`/products/${slug}`)
    revalidatePath('/')
}

export async function updateProductImages(productId: string, images: ImageRecord[]) {
    const session = await auth()
    if (!session) throw new Error('Unauthorized')

    const product = await prisma.product.update({
        where: { id: productId },
        data: { images: JSON.parse(JSON.stringify(images)) },
        select: { slug: true },
    })
    revalidate(productId, product.slug)
}
