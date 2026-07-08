'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

function revalidate(productId: string) {
    revalidatePath(`/admin/products/${productId}/sizing`)
    revalidatePath(`/admin/products/${productId}/edit`)
}

export async function addAttributeToProduct(productId: string, sizingAttributeId: string) {
    const session = await auth()
    if (!session) throw new Error('Unauthorized')

    const max = await prisma.productSizingAttribute.aggregate({
        where: { productId },
        _max: { sortOrder: true },
    })

    await prisma.productSizingAttribute.upsert({
        where: {
            productId_sizingAttributeId: { productId, sizingAttributeId },
        },
        create: {
            productId,
            sizingAttributeId,
            sortOrder: (max._max.sortOrder ?? 0) + 1,
        },
        update: {},
    })
    revalidate(productId)
}

export async function addCategoryToProduct(productId: string, category: string) {
    const session = await auth()
    if (!session) throw new Error('Unauthorized')

    const cat = category.trim()
    if (!cat) throw new Error('Category required')

    const [attrs, existing, max] = await Promise.all([
        prisma.sizingAttribute.findMany({
            where: { category: cat, enabled: true },
            orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
            select: { id: true },
        }),
        prisma.productSizingAttribute.findMany({
            where: { productId },
            select: { sizingAttributeId: true },
        }),
        prisma.productSizingAttribute.aggregate({
            where: { productId },
            _max: { sortOrder: true },
        }),
    ])

    const haveIds = new Set(existing.map((e) => e.sizingAttributeId))
    let next = (max._max.sortOrder ?? 0) + 1
    const data = attrs
        .filter((a) => !haveIds.has(a.id))
        .map((a) => ({
            productId,
            sizingAttributeId: a.id,
            sortOrder: next++,
        }))

    if (data.length > 0) {
        await prisma.productSizingAttribute.createMany({ data, skipDuplicates: true })
    }
    revalidate(productId)
}

export async function removeCategoryFromProduct(productId: string, category: string) {
    const session = await auth()
    if (!session) throw new Error('Unauthorized')

    const cat = category.trim()
    if (!cat) throw new Error('Category required')

    const attrs = await prisma.sizingAttribute.findMany({
        where: { category: cat },
        select: { id: true },
    })
    const attrIds = attrs.map((a) => a.id)
    if (attrIds.length === 0) {
        revalidate(productId)
        return
    }

    const sizes = await prisma.productSize.findMany({
        where: { productId },
        select: { id: true },
    })
    const sizeIds = sizes.map((s) => s.id)

    await prisma.$transaction([
        prisma.productSizeMeasurement.deleteMany({
            where: {
                sizingAttributeId: { in: attrIds },
                productSizeId: { in: sizeIds },
            },
        }),
        prisma.productSizingAttribute.deleteMany({
            where: { productId, sizingAttributeId: { in: attrIds } },
        }),
    ])
    revalidate(productId)
}

export async function removeAttributeFromProduct(
    productId: string,
    sizingAttributeId: string,
) {
    const session = await auth()
    if (!session) throw new Error('Unauthorized')

    // Wipe values for this product+attribute (cascade is by productSize, not
    // by product, so do it explicitly).
    const sizes = await prisma.productSize.findMany({
        where: { productId },
        select: { id: true },
    })
    const sizeIds = sizes.map((s) => s.id)

    await prisma.$transaction([
        prisma.productSizeMeasurement.deleteMany({
            where: {
                sizingAttributeId,
                productSizeId: { in: sizeIds },
            },
        }),
        prisma.productSizingAttribute.delete({
            where: {
                productId_sizingAttributeId: { productId, sizingAttributeId },
            },
        }),
    ])
    revalidate(productId)
}

export async function reorderAttribute(
    productId: string,
    sizingAttributeId: string,
    direction: 'up' | 'down',
) {
    const session = await auth()
    if (!session) throw new Error('Unauthorized')

    const rows = await prisma.productSizingAttribute.findMany({
        where: { productId },
        orderBy: { sortOrder: 'asc' },
    })
    const i = rows.findIndex((r) => r.sizingAttributeId === sizingAttributeId)
    if (i < 0) return

    const j = direction === 'up' ? i - 1 : i + 1
    if (j < 0 || j >= rows.length) return

    await prisma.$transaction([
        prisma.productSizingAttribute.update({
            where: {
                productId_sizingAttributeId: {
                    productId,
                    sizingAttributeId: rows[i].sizingAttributeId,
                },
            },
            data: { sortOrder: rows[j].sortOrder },
        }),
        prisma.productSizingAttribute.update({
            where: {
                productId_sizingAttributeId: {
                    productId,
                    sizingAttributeId: rows[j].sizingAttributeId,
                },
            },
            data: { sortOrder: rows[i].sortOrder },
        }),
    ])
    revalidate(productId)
}

export async function setMeasurement(
    productId: string,
    productSizeId: string,
    sizingAttributeId: string,
    value: string,
) {
    const session = await auth()
    if (!session) throw new Error('Unauthorized')

    const trimmed = value.trim()

    if (!trimmed) {
        // Empty input clears the cell.
        await prisma.productSizeMeasurement.deleteMany({
            where: { productSizeId, sizingAttributeId },
        })
    } else {
        await prisma.productSizeMeasurement.upsert({
            where: {
                productSizeId_sizingAttributeId: { productSizeId, sizingAttributeId },
            },
            create: { productSizeId, sizingAttributeId, value: trimmed },
            update: { value: trimmed },
        })
    }
    revalidate(productId)
}
