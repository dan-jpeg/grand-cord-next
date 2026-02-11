import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { prisma } from './prisma'
import bcrypt from 'bcryptjs'

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
            authorize: async (credentials) => {
                const identifier = credentials?.identifier as string
                const password = credentials?.password as string

                if (!identifier || !password) {
                    throw new Error('Missing credentials')
                }

                const admin = await prisma.adminUser.findUnique({
                    where: { email: identifier },
                })

                if (!admin) {
                    throw new Error('Invalid credentials')
                }

                const isValidPassword = await bcrypt.compare(password, admin.password)

                if (!isValidPassword) {
                    throw new Error('Invalid credentials')
                }

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
