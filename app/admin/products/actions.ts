'use server'

import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { slugify } from '@/lib/utils'
import { normalizeDesignerNames } from '@/lib/designers'
import { auth } from '@/lib/auth'
import type { Prisma } from '@prisma/client'

type ProductFormData = {
    name: string
    slug?: string
    description?: string
    keywords?: string[]
    designerNames?: string[]
    material?: string
    color?: string
    colorHex?: string
    attribute1?: string
    attribute2?: string
    price: number
    published: boolean
    images: {
        url: string
        isMobilePrimary: boolean
        isDesktopPrimary: boolean
        isCartPrimary: boolean
        isGrid1x1Primary: boolean
        isGrid2x2Primary: boolean
        isGrid3x3Primary: boolean
        isInventoryPrimary?: boolean
        showOnPdp: boolean
    }[]
    sizes: {
        size: string
        available: number
    }[]
}

function normalizeKeywords(keywords?: string[]): string[] {
    if (!keywords) return []
    return [...new Set(
        keywords
            .map((keyword) => keyword.trim().toLowerCase())
            .filter(Boolean)
    )]
}


/** Creates a blank, unpublished draft and returns its id.
 *  The "New Item +" flow drops straight into the normal edit view rather than a
 *  separate create form, so the row has to exist first — every field there
 *  commits on blur against a product id. No Stripe product is created yet: the
 *  draft has no name or price to sync, and updateProduct picks Stripe back up
 *  once a stripeProductId exists. The placeholder slug keeps the unique
 *  constraint happy while the name is still empty. */
export async function createDraftProduct(): Promise<string> {
    const session = await auth()
    if (!session) throw new Error('Not authenticated')

    const product = await prisma.product.create({
        data: {
            name: '',
            slug: `draft-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
            price: 0,
            published: false,
            images: [],
        },
    })

    // No revalidatePath here — this runs during the /admin/products/new render,
    // where revalidation isn't allowed. The inventory pages are force-dynamic,
    // so they pick the draft up on their next request anyway.
    return product.id
}

export async function createProduct(data: ProductFormData) {
    const slug = data.slug || slugify(data.name)
    const designerNames = normalizeDesignerNames(data.designerNames)
    const keywords = normalizeKeywords(data.keywords)

    // Check if slug exists
    const existing = await prisma.product.findUnique({
        where: { slug }
    })

    if (existing) {
        throw new Error(`A product with slug "${slug}" already exists. Please use a different name or slug.`)
    }

    // Create product in Stripe
    const stripeProduct = await stripe.products.create({
        name: data.name,
        description: data.description || undefined,
        images: data.images.length > 0 ? [data.images[0].url] : undefined,
        metadata: {
            slug,
            designerName: designerNames[0] || '',
            designerNames: designerNames.join(', '),
            material: data.material || '',
            color: data.color || '',
            keywords: keywords.join(', '),
        },
    })

    // Create price in Stripe
    await stripe.prices.create({
        product: stripeProduct.id,
        unit_amount: Math.round(data.price * 100),
        currency: 'usd',
    })

    // Create product in database
    const createPayload: Prisma.ProductCreateInput = {
        name: data.name,
        slug,
        description: data.description,
        designerNames,
        material: data.material,
        color: data.color,
        colorHex: data.colorHex,
        attribute1: data.attribute1,
        attribute2: data.attribute2,
        price: data.price,
        published: data.published,
        images: JSON.parse(JSON.stringify(data.images)),
        stripeProductId: stripeProduct.id,
        sizes: {
            create: data.sizes.map(s => ({  // Changed from uniqueSizes to data.sizes
                size: s.size,
                available: s.available,
                committed: 0,
                total: s.available,
            })),
        },
    }
    ;(createPayload as Record<string, unknown>).keywords = keywords

    await prisma.product.create({
        data: createPayload,
    })
    revalidatePath('/admin/products')
    redirect('/admin/products')
}

export async function updateProduct(id: string, data: ProductFormData) {
    const designerNames = normalizeDesignerNames(data.designerNames)
    const keywords = normalizeKeywords(data.keywords)
    // Get existing product to check for Stripe product ID
    const existingProduct = await prisma.product.findUnique({
        where: { id },
    })

    // Update Stripe product if it exists
    if (existingProduct?.stripeProductId) {
        try {
            await stripe.products.update(existingProduct.stripeProductId, {
                name: data.name,
                description: data.description || undefined,
                images: data.images.length > 0 ? [data.images[0].url] : undefined,
                metadata: {
                    slug: data.slug || slugify(data.name),
                    designerName: designerNames[0] || '',
                    designerNames: designerNames.join(', '),
                    material: data.material || '',
                    color: data.color || '',
                    keywords: keywords.join(', '),
                },
            })

            if (data.price !== existingProduct.price) {
                await stripe.prices.create({
                    product: existingProduct.stripeProductId,
                    unit_amount: Math.round(data.price * 100),
                    currency: 'usd',
                })
            }
        } catch (error) {
            console.error('Error updating Stripe product:', error)
        }
    }

    // Sizes are intentionally not touched here. Adding/removing a size and
    // adjusting its stock are all inventory mutations, not product-listing
    // edits — they go through the lock/commit flow (commitInventoryChanges)
    // so every change is atomic and shows up in the inventory log. This form
    // submit is for name/price/images/etc. only.
    const updatePayload: Prisma.ProductUpdateInput = {
        name: data.name,
        slug: data.slug || slugify(data.name),
        description: data.description,
        designerNames,
        material: data.material,
        color: data.color,
        colorHex: data.colorHex,
        attribute1: data.attribute1,
        attribute2: data.attribute2,
        price: data.price,
        published: data.published,
        images: JSON.parse(JSON.stringify(data.images)),
    }
    ;(updatePayload as Record<string, unknown>).keywords = keywords

    await prisma.product.update({
        where: { id },
        data: updatePayload,
    })

    revalidatePath('/admin/products')
    revalidatePath(`/admin/products/${id}/edit`)
}

export async function updateSizeStock(sizeId: string, delta: number) {
    const size = await prisma.productSize.findUnique({ where: { id: sizeId } })
    if (!size) return
    const newAvailable = Math.max(0, size.available + delta)
    await prisma.productSize.update({
        where: { id: sizeId },
        data: {
            available: newAvailable,
            total: newAvailable + size.committed,
        },
    })
    revalidatePath('/admin/products')
}

export async function commitInventoryChanges(
    productId: string,
    changes: { sizeId: string; delta: number }[],
    additions: { size: string; available: number }[] = [],
    removals: string[] = [],
) {
    if (!changes.length && !additions.length && !removals.length) {
        return { ok: true as const, createdSizes: [] as { id: string; size: string; available: number }[] }
    }

    const session = await auth()
    if (!session?.user) {
        throw new Error('Not authenticated')
    }
    const adminUserId = (session.user.id as string | undefined) ?? null
    const adminEmail = (session.user.email as string | undefined) ?? 'unknown'
    const adminName = (session.user.name as string | null | undefined) ?? null

    const product = await prisma.product.findUnique({
        where: { id: productId },
        select: { id: true, name: true },
    })
    if (!product) throw new Error('Product not found')

    const sizes = await prisma.productSize.findMany({
        where: { id: { in: changes.map((c) => c.sizeId) } },
    })
    const sizeById = new Map(sizes.map((s) => [s.id, s]))

    // Adding a size is allowed unconditionally. Removing one is only allowed
    // once its stock (and any order holds) have been zeroed out — the client
    // guards this via the lock flow, but a stale payload could otherwise
    // wipe stock here, so re-check server-side.
    const removalSizes = removals.length
        ? await prisma.productSize.findMany({ where: { id: { in: removals } } })
        : []
    const blocking = removalSizes.filter((s) => s.available > 0 || s.committed > 0)
    if (blocking.length > 0) {
        const detail = blocking
            .map((s) => `${s.size} (${s.available} avail, ${s.committed} reserved)`)
            .join(', ')
        throw new Error(
            `Cannot remove size with inventory: ${detail}. Zero out stock and fulfill/cancel any open orders first.`,
        )
    }

    const createdSizes: { id: string; size: string; available: number }[] = []

    await prisma.$transaction(async (tx) => {
        for (const { sizeId, delta } of changes) {
            if (!delta) continue
            const size = sizeById.get(sizeId)
            if (!size) continue
            const before = size.available
            const after = Math.max(0, before + delta)
            const effectiveDelta = after - before
            if (effectiveDelta === 0) continue

            await tx.productSize.update({
                where: { id: sizeId },
                data: { available: after, total: after + size.committed },
            })
            await tx.inventoryChangeLog.create({
                data: {
                    productId: product.id,
                    productSizeId: size.id,
                    productName: product.name,
                    sizeLabel: size.size,
                    delta: effectiveDelta,
                    before,
                    after,
                    adminUserId,
                    adminEmail,
                    adminName,
                },
            })
        }

        for (const a of additions) {
            const label = a.size.trim()
            if (!label) continue
            const available = Math.max(0, a.available)
            const created = await tx.productSize.create({
                data: {
                    productId: product.id,
                    size: label,
                    available,
                    committed: 0,
                    total: available,
                },
            })
            createdSizes.push({ id: created.id, size: created.size, available: created.available })
            if (available > 0) {
                await tx.inventoryChangeLog.create({
                    data: {
                        productId: product.id,
                        productSizeId: created.id,
                        productName: product.name,
                        sizeLabel: label,
                        delta: available,
                        before: 0,
                        after: available,
                        adminUserId,
                        adminEmail,
                        adminName,
                    },
                })
            }
        }

        for (const s of removalSizes) {
            await tx.productSize.delete({ where: { id: s.id } })
        }
    })

    revalidatePath('/admin/products')
    revalidatePath(`/admin/products/${productId}/edit`)
    revalidatePath('/admin/logs')
    return { ok: true as const, createdSizes }
}

export async function deleteProduct(id: string) {
    // Get product to check for Stripe product ID
    const product = await prisma.product.findUnique({
        where: { id },
    })

    // Archive product in Stripe (can't delete products with prices)
    if (product?.stripeProductId) {
        try {
            await stripe.products.update(product.stripeProductId, {
                active: false,
            })
        } catch (error) {
            console.error('Error archiving Stripe product:', error)
        }
    }

    await prisma.product.delete({
        where: { id },
    })

    revalidatePath('/admin/products')
    revalidatePath('/admin/products-new')
}
