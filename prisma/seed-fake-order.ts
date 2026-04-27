import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { config } from 'dotenv'

config({ path: '.env' })
config({ path: '.env.local', override: true })

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

async function main() {
    const products = await prisma.product.findMany({
        where: { published: true },
        select: { id: true, name: true, slug: true, price: true },
        take: 2,
    })
    if (products.length === 0) throw new Error('No published product found to seed order with')

    // Use two distinct products if available, otherwise duplicate with different size
    const items = products.length >= 2
        ? [
            { product: products[0], size: 'M', quantity: 1 },
            { product: products[1], size: 'L', quantity: 1 },
        ]
        : [
            { product: products[0], size: 'M', quantity: 1 },
            { product: products[0], size: 'L', quantity: 1 },
        ]

    const createdAt = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000 + Math.floor(Math.random() * 3600 * 1000))
    const orderNumber = `GC-FAKE-${Math.floor(Math.random() * 900 + 100)}`
    const total = items.reduce((s, it) => s + it.product.price * it.quantity, 0)

    const order = await prisma.order.create({
        data: {
            orderNumber,
            email: 'yellow-test@example.com',
            status: 'PAID',
            total,
            stripePaymentIntentId: `pi_fake_${Date.now()}`,
            createdAt,
            updatedAt: createdAt,
            shippingAddress: {
                name: 'Yellow Indicator',
                address: '123 Fake Street',
                city: 'Brooklyn',
                state: 'NY',
                zip: '11211',
                country: 'US',
            },
            items: {
                create: items.map(it => ({
                    productId: it.product.id,
                    productName: it.product.name,
                    productSlug: it.product.slug,
                    size: it.size,
                    quantity: it.quantity,
                    price: it.product.price,
                })),
            },
        },
    })

    console.log(`Created fake order ${order.orderNumber} (${order.id}) dated ${createdAt.toISOString()}`)
}

main()
    .catch(e => { console.error(e); process.exit(1) })
    .finally(() => prisma.$disconnect())
