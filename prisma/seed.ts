import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import bcrypt from 'bcryptjs'

const connectionString = process.env.DATABASE_URL!
const pool = new Pool({ connectionString })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
    console.log('🌱 Starting database seed...')

    // Create admin user
    const hashedPassword = await bcrypt.hash('admin123', 10)

    const admin = await prisma.adminUser.upsert({
        where: { email: 'admin@example.com' },
        update: {},
        create: {
            email: 'admin@example.com',
            name: 'Admin User',
            password: hashedPassword,
        },
    })

    console.log('✅ Admin user created:', admin.email)
    console.log('📧 Email: admin@example.com')
    console.log('🔑 Password: admin123')
    console.log('⚠️  Change this password after first login!')

    // Create sample products
// Create sample products
    const tshirt = await prisma.product.upsert({
        where: { slug: 'essential-tshirt' },
        update: {},
        create: {
            name: 'Essential T-Shirt',
            slug: 'essential-tshirt',
            description: 'A comfortable cotton t-shirt perfect for everyday wear',
            designerName: 'Studio Brand',
            price: 29.99,
            images: [],
            published: true,
            sizes: {
                create: [
                    { size: 'S', stock: 10 },
                    { size: 'M', stock: 15 },
                    { size: 'L', stock: 12 },
                    { size: 'XL', stock: 8 },
                ],
            },
        },
    })

    const hoodie = await prisma.product.upsert({
        where: { slug: 'classic-hoodie' },
        update: {},
        create: {
            name: 'Classic Hoodie',
            slug: 'classic-hoodie',
            description: 'Cozy heavyweight hoodie with kangaroo pocket',
            designerName: 'Studio Brand',
            price: 59.99,
            images: [],
            published: true,
            sizes: {
                create: [
                    { size: 'S', stock: 5 },
                    { size: 'M', stock: 8 },
                    { size: 'L', stock: 10 },
                    { size: 'XL', stock: 6 },
                ],
            },
        },
    })

    console.log('✅ Sample products created:', tshirt.name, hoodie.name)

    // Create sample collection
    const collection = await prisma.collection.upsert({
        where: { slug: 'new-arrivals' },
        update: {},
        create: {
            name: 'New Arrivals',
            slug: 'new-arrivals',
            description: 'Check out our latest products',
        },
    })

    // Create sample blog post
    const post = await prisma.blogPost.upsert({
        where: { slug: 'welcome' },
        update: {},
        create: {
            title: 'Welcome to Our Store',
            slug: 'welcome',
            content: '<p>Welcome to our new store! We are excited to share our products with you.</p>',
            excerpt: 'Welcome to our new store!',
            published: true,
            publishedAt: new Date(),
        },
    })

    console.log('✅ Sample blog post created:', post.title)

    // Create sample orders
    const order1 = await prisma.order.create({
        data: {
            orderNumber: 'ORD-TEST001',
            email: 'customer@example.com',
            status: 'PAID',
            total: 89.98,
            stripePaymentIntentId: 'pi_test_12345',
            shippingAddress: {
                name: 'John Doe',
                address: '123 Main St',
                city: 'New York',
                state: 'NY',
                zip: '10001',
                country: 'USA',
            },
            items: {
                create: [
                    {
                        productId: tshirt.id,
                        productName: tshirt.name,
                        productSlug: tshirt.slug,
                        size: 'M',
                        quantity: 2,
                        price: tshirt.price,
                    },
                    {
                        productId: hoodie.id,
                        productName: hoodie.name,
                        productSlug: hoodie.slug,
                        size: 'L',
                        quantity: 1,
                        price: hoodie.price,
                    },
                ],
            },
        },
    })

    const order2 = await prisma.order.create({
        data: {
            orderNumber: 'ORD-TEST002',
            email: 'jane@example.com',
            status: 'SHIPPED',
            total: 29.99,
            stripePaymentIntentId: 'pi_test_67890',
            trackingNumber: '1Z999AA10123456784',
            trackingUrl: 'https://www.ups.com/track?loc=en_US&tracknum=1Z999AA10123456784',
            shippingAddress: {
                name: 'Jane Smith',
                address: '456 Oak Ave',
                city: 'Los Angeles',
                state: 'CA',
                zip: '90001',
                country: 'USA',
            },
            items: {
                create: [
                    {
                        productId: tshirt.id,
                        productName: tshirt.name,
                        productSlug: tshirt.slug,
                        size: 'S',
                        quantity: 1,
                        price: tshirt.price,
                    },
                ],
            },
        },
    })

    const order3 = await prisma.order.create({
        data: {
            orderNumber: 'ORD-TEST003',
            email: 'bob@example.com',
            status: 'PENDING',
            total: 59.99,
            stripePaymentIntentId: 'pi_test_pending',
            shippingAddress: {
                name: 'Bob Johnson',
                address: '789 Pine Rd',
                city: 'Chicago',
                state: 'IL',
                zip: '60601',
                country: 'USA',
            },
            items: {
                create: [
                    {
                        productId: hoodie.id,
                        productName: hoodie.name,
                        productSlug: hoodie.slug,
                        size: 'XL',
                        quantity: 1,
                        price: hoodie.price,
                    },
                ],
            },
        },
    })

    console.log('✅ Sample orders created:', order1.orderNumber, order2.orderNumber, order3.orderNumber)

    console.log('🎉 Database seeded successfully!')
}

main()
    .catch((e) => {
        console.error('❌ Seed failed:', e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })