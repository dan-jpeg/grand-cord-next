// Seeds only what production needs: a single AdminUser account. No mock
// products, orders, or test data — run this against a fresh prod database
// after `prisma migrate deploy`.
//
// Usage:
//   PROD_ADMIN_EMAIL=you@example.com PROD_ADMIN_PASSWORD='...' \
//     npx tsx prisma/seed-production.ts --env-file=.env.production

import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import bcrypt from 'bcryptjs'
import { config } from 'dotenv'

const envFileArg = process.argv.find((a) => a.startsWith('--env-file='))
config({ path: envFileArg ? envFileArg.split('=')[1] : '.env.production' })

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

async function main() {
    const email = process.env.PROD_ADMIN_EMAIL
    const password = process.env.PROD_ADMIN_PASSWORD
    const name = process.env.PROD_ADMIN_NAME

    if (!email || !password) {
        throw new Error(
            'Set PROD_ADMIN_EMAIL and PROD_ADMIN_PASSWORD before running this script.',
        )
    }
    if (password.length < 12) {
        throw new Error('PROD_ADMIN_PASSWORD should be at least 12 characters.')
    }

    const hashed = await bcrypt.hash(password, 12)

    const admin = await prisma.adminUser.upsert({
        where: { email },
        update: { password: hashed, name },
        create: { email, password: hashed, name },
    })

    console.log(`Admin user ready: ${admin.email} (${admin.id})`)
}

main()
    .catch((err) => {
        console.error(err)
        process.exit(1)
    })
    .finally(() => prisma.$disconnect())
