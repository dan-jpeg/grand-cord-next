import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { prisma } from './prisma'
import bcrypt from 'bcryptjs'

export const { handlers, signIn, signOut, auth } = NextAuth({
    providers: [
        Credentials({
            credentials: {
                email: { label: 'Email', type: 'email' },
                password: { label: 'Password', type: 'password' },
            },
            authorize: async (credentials) => {
                const email = credentials?.email as string
                const password = credentials?.password as string

                if (!email || !password) {
                    throw new Error('Missing credentials')
                }

                const admin = await prisma.adminUser.findUnique({
                    where: { email },
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
})