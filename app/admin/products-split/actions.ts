'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { normalizeDesignerNames } from '@/lib/designers'
import { revalidatePath } from 'next/cache'

export async function getProductDetail(id: string) {
    const session = await auth()
    if (!session) throw new Error('Unauthorized')

    const [orders, inventoryLogs] = await Promise.all([
        prisma.order.findMany({
            where: { items: { some: { productId: id } } },
            include: { items: { where: { productId: id } } },
            orderBy: { createdAt: 'desc' },
            take: 20,
        }),
        prisma.inventoryChangeLog.findMany({
            where: { productId: id },
            orderBy: { createdAt: 'desc' },
            take: 100,
        }),
    ])

    return { orders, inventoryLogs }
}

type IdentityPatch = {
    material?: string | null
    color?: string | null
    price?: number
    designerNames?: string[]
}

export async function patchProductIdentity(id: string, data: IdentityPatch) {
    const session = await auth()
    if (!session) throw new Error('Unauthorized')

    const updateData: Record<string, unknown> = {}
    if ('material' in data) updateData.material = data.material || null
    if ('color' in data) updateData.color = data.color || null
    if (typeof data.price === 'number' && Number.isFinite(data.price)) {
        updateData.price = data.price
    }
    if (data.designerNames) {
        updateData.designerNames = normalizeDesignerNames(data.designerNames)
    }

    if (Object.keys(updateData).length === 0) return

    await prisma.product.update({ where: { id }, data: updateData })
    revalidatePath('/admin/products-split')
}
