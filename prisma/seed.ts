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