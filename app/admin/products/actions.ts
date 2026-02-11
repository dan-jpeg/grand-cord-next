'use server'

import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { slugify } from '@/lib/utils'
import { normalizeDesignerNames } from '@/lib/designers'

type ProductFormData = {
    name: string
    slug?: string
    description?: string
    designerNames?: string[]
    material?: string
    color?: string
    colorHex?: string
    price: number
    published: boolean
    images: {
        url: string
        isMobilePrimary: boolean
        isDesktopPrimary: boolean
    }[]
    sizes: {
        size: string
        available: number
    }[]
}

// In createProduct and updateProduct:


export async function createProduct(data: ProductFormData) {
    const slug = data.slug || slugify(data.name)
    const designerNames = normalizeDesignerNames(data.designerNames)

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
        },
    })

    // Create price in Stripe
    await stripe.prices.create({
        product: stripeProduct.id,
        unit_amount: Math.round(data.price * 100),
        currency: 'usd',
    })

    // Create product in database
    await prisma.product.create({
        data: {
            name: data.name,
            slug,
            description: data.description,
            designerNames,
            material: data.material,
            color: data.color,
            colorHex: data.colorHex,
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
        },
    })
    revalidatePath('/admin/products')
    redirect('/admin/products')
}

export async function updateProduct(id: string, data: ProductFormData) {
    const designerNames = normalizeDesignerNames(data.designerNames)
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

    // Filter out duplicate sizes (keep only unique size values)
    const uniqueSizes = data.sizes.filter((size, index, self) =>
        index === self.findIndex(s => s.size === size.size)
    )

    // Use transaction to delete and create sizes
    await prisma.$transaction([
        // Delete existing sizes
        prisma.productSize.deleteMany({
            where: { productId: id },
        }),
        // Update product and create new sizes
        prisma.product.update({
            where: { id },
            data: {
                name: data.name,
                slug: data.slug || slugify(data.name),
                description: data.description,
                designerNames,
                material: data.material,
                color: data.color,
                colorHex: data.colorHex,
                price: data.price,
                published: data.published,
                images: JSON.parse(JSON.stringify(data.images)),
                sizes: {
                    create: uniqueSizes.map(s => ({
                        size: s.size,
                        available: s.available,
                        committed: 0,
                        total: s.available,
                    })),
                },
            },
        }),
    ])

    revalidatePath('/admin/products')
    revalidatePath(`/admin/products/${id}/edit`)
    redirect('/admin/products')
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
}
