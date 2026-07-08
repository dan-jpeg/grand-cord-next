'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

function slugify(name: string): string {
    return name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 64) || 'group'
}

async function ensureUniqueSlug(base: string, excludeId?: string): Promise<string> {
    let candidate = base
    let n = 2
    // eslint-disable-next-line no-constant-condition
    while (true) {
        const existing = await prisma.collection.findUnique({ where: { slug: candidate } })
        if (!existing || existing.id === excludeId) return candidate
        candidate = `${base}-${n++}`
    }
}

export async function createCatalogGroup(input: {
    name: string
    description?: string
}) {
    const session = await auth()
    if (!session) throw new Error('Unauthorized')

    const name = input.name.trim()
    if (!name) throw new Error('Name required')

    const slug = await ensureUniqueSlug(slugify(name))
    const maxSort = await prisma.collection.aggregate({ _max: { sortOrder: true } })

    const created = await prisma.collection.create({
        data: {
            name,
            slug,
            description: input.description?.trim() || null,
            sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
        },
    })
    revalidatePath('/admin/manage-catalog')
    return created
}

export async function updateCatalogGroup(
    id: string,
    patch: {
        name?: string
        description?: string | null
        showInCatalog?: boolean
        showInSample?: boolean
        showInSearch?: boolean
    },
) {
    const session = await auth()
    if (!session) throw new Error('Unauthorized')

    const data: Record<string, unknown> = {}
    if (typeof patch.name === 'string') {
        const trimmed = patch.name.trim()
        if (!trimmed) throw new Error('Name required')
        data.name = trimmed
        const baseSlug = slugify(trimmed)
        data.slug = await ensureUniqueSlug(baseSlug, id)
    }
    if (patch.description !== undefined) {
        data.description = patch.description?.toString().trim() || null
    }
    if (patch.showInCatalog !== undefined) data.showInCatalog = patch.showInCatalog
    if (patch.showInSample !== undefined) data.showInSample = patch.showInSample
    if (patch.showInSearch !== undefined) data.showInSearch = patch.showInSearch

    await prisma.collection.update({ where: { id }, data })
    revalidatePath('/admin/manage-catalog')
    revalidatePath('/')
    revalidatePath('/sample')
}

export async function deleteCatalogGroup(id: string) {
    const session = await auth()
    if (!session) throw new Error('Unauthorized')

    await prisma.collection.delete({ where: { id } })
    revalidatePath('/admin/manage-catalog')
    revalidatePath('/')
    revalidatePath('/sample')
}

export async function addProductToGroup(groupId: string, productId: string) {
    const session = await auth()
    if (!session) throw new Error('Unauthorized')

    const max = await prisma.collectionProduct.aggregate({
        where: { collectionId: groupId },
        _max: { order: true },
    })

    await prisma.collectionProduct.upsert({
        where: {
            collectionId_productId: { collectionId: groupId, productId },
        },
        create: {
            collectionId: groupId,
            productId,
            order: (max._max.order ?? 0) + 1,
        },
        update: {},
    })
    revalidatePath('/admin/manage-catalog')
    revalidatePath('/')
    revalidatePath('/sample')
}

export async function removeProductFromGroup(groupId: string, productId: string) {
    const session = await auth()
    if (!session) throw new Error('Unauthorized')

    await prisma.collectionProduct.delete({
        where: {
            collectionId_productId: { collectionId: groupId, productId },
        },
    })
    revalidatePath('/admin/manage-catalog')
    revalidatePath('/')
    revalidatePath('/sample')
}

export async function createSizingAttribute(input: {
    title: string
    description?: string
    category: string
}) {
    const session = await auth()
    if (!session) throw new Error('Unauthorized')

    const title = input.title.trim()
    const category = input.category.trim()
    if (!title) throw new Error('Title required')
    if (!category) throw new Error('Category required')

    const maxSort = await prisma.sizingAttribute.aggregate({
        where: { category },
        _max: { sortOrder: true },
    })

    await prisma.sizingAttribute.create({
        data: {
            title,
            category,
            description: input.description?.trim() || null,
            sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
        },
    })
    revalidatePath('/admin/manage-catalog')
}

export async function updateSizingAttribute(
    id: string,
    patch: {
        title?: string
        description?: string | null
        category?: string
        enabled?: boolean
    },
) {
    const session = await auth()
    if (!session) throw new Error('Unauthorized')

    const data: Record<string, unknown> = {}
    if (typeof patch.title === 'string') {
        const t = patch.title.trim()
        if (!t) throw new Error('Title required')
        data.title = t
    }
    if (typeof patch.category === 'string') {
        const c = patch.category.trim()
        if (!c) throw new Error('Category required')
        data.category = c
    }
    if (patch.description !== undefined) {
        data.description = patch.description?.toString().trim() || null
    }
    if (patch.enabled !== undefined) data.enabled = patch.enabled

    await prisma.sizingAttribute.update({ where: { id }, data })
    revalidatePath('/admin/manage-catalog')
}

export async function deleteSizingAttribute(id: string) {
    const session = await auth()
    if (!session) throw new Error('Unauthorized')

    await prisma.sizingAttribute.delete({ where: { id } })
    revalidatePath('/admin/manage-catalog')
}

export async function setCategoryEnabled(category: string, enabled: boolean) {
    const session = await auth()
    if (!session) throw new Error('Unauthorized')

    const cat = category.trim()
    if (!cat) throw new Error('Category required')

    await prisma.sizingAttribute.updateMany({
        where: { category: cat },
        data: { enabled },
    })
    revalidatePath('/admin/manage-catalog')
}

export async function updateSiteSettings(patch: {
    showSearchInNav?: boolean
    showSampleInNav?: boolean
    scrollToTopOnCatalogTapMobile?: boolean
    scrollToTopOnCatalogTapDesktop?: boolean
}) {
    const session = await auth()
    if (!session) throw new Error('Unauthorized')

    const data: Record<string, unknown> = {}
    if (patch.showSearchInNav !== undefined) data.showSearchInNav = patch.showSearchInNav
    if (patch.showSampleInNav !== undefined) data.showSampleInNav = patch.showSampleInNav
    if (patch.scrollToTopOnCatalogTapMobile !== undefined) data.scrollToTopOnCatalogTapMobile = patch.scrollToTopOnCatalogTapMobile
    if (patch.scrollToTopOnCatalogTapDesktop !== undefined) data.scrollToTopOnCatalogTapDesktop = patch.scrollToTopOnCatalogTapDesktop

    await prisma.siteSettings.upsert({
        where: { id: 'default' },
        create: { id: 'default', ...data },
        update: data,
    })
    revalidatePath('/admin/manage-catalog')
    revalidatePath('/')
    revalidatePath('/sample')
}
