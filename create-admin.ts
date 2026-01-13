import 'dotenv/config'
import { prisma } from './lib/prisma'
import bcrypt from 'bcryptjs'

async function createAdmin() {
    const email = 'admin@example.com'
    const password = 'admin123'

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
    console.log('Password:', password)
    console.log('\nLogin at: http://localhost:3000/admin/login')
}

createAdmin()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })