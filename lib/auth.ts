import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { prisma } from './prisma'
import bcrypt from 'bcryptjs'
import {
    assertNotThrottled,
    clearAttempts,
    clientIpFrom,
    recordFailedAttempt,
} from './login-throttle'

if (!process.env.AUTH_SECRET) {
    throw new Error('AUTH_SECRET environment variable is not set')
}

export const { handlers, signIn, signOut, auth } = NextAuth({
    providers: [
        Credentials({
            credentials: {
                identifier: { label: 'Login', type: 'text' },
                password: { label: 'Password', type: 'password' },
            },
            authorize: async (credentials, request) => {
                const identifier = credentials?.identifier as string
                const password = credentials?.password as string

                if (!identifier || !password) {
                    throw new Error('Missing credentials')
                }

                const ip = clientIpFrom(request)

                // Before the password check, so a locked-out attacker cannot
                // use response timing to tell a real login from a made-up one.
                await assertNotThrottled(identifier, ip)

                const admin = await prisma.adminUser.findUnique({
                    where: { email: identifier },
                })

                // A miss is recorded exactly like a wrong password. Skipping it
                // for unknown logins would make this a way to enumerate which
                // addresses are real.
                if (!admin) {
                    await recordFailedAttempt(identifier, ip)
                    throw new Error('Invalid credentials')
                }

                const isValidPassword = await bcrypt.compare(password, admin.password)

                if (!isValidPassword) {
                    await recordFailedAttempt(identifier, ip)
                    throw new Error('Invalid credentials')
                }

                await clearAttempts(identifier)

                return {
                    id: admin.id,
                    email: admin.email,
                    name: admin.name,
                }
            },
        }),
    ],
    pages: {
        signIn: '/admin/login',
    },
    session: {
        strategy: 'jwt',
        maxAge: 30 * 24 * 60 * 60,
    },
    callbacks: {
        jwt({ token, user }) {
            if (user) {
                token.id = user.id
            }
            return token
        },
        session({ session, token }) {
            if (token) {
                session.user.id = token.id as string
            }
            return session
        },
    },
    trustHost: true,
    debug: process.env.NODE_ENV === 'development',
})
