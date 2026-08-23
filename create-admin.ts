import 'dotenv/config'
import { prisma } from './lib/prisma'
import bcrypt from 'bcryptjs'

async function createAdmin() {
    // Never hardcode these. The previous literals are burned — they are in
    // git history — so the account they created must be rotated, not reused.
    const email = process.env.ADMIN_EMAIL
    const password = process.env.ADMIN_PASSWORD

    if (!email || !password) {
        throw new Error(
            'Set ADMIN_EMAIL and ADMIN_PASSWORD in .env before running this script.'
        )
    }
    if (password.length < 8) {
        throw new Error('ADMIN_PASSWORD must be at least 8 characters')
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    const admin = await prisma.adminUser.upsert({
        where: { email },
        update: {
            password: hashedPassword
        },
        create: {
            email,
            password: hashedPassword,
            name: 'Admin'
        }
    })

    console.log('✅ Admin user ready!')
    console.log('Email:', email)
    console.log('\nLogin at: http://localhost:3000/admin/login')
}

createAdmin()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })