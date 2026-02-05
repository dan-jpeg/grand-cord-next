// lib/prisma.ts
import { PrismaClient } from '@prisma/client'

/**
 * Use a global variable to preserve the Prisma client across hot reloads in development
 * and across serverless invocations in production.
 */
declare global {
    // eslint-disable-next-line no-var
    var prisma: PrismaClient | undefined
}

export const prisma: PrismaClient =
    globalThis.prisma ??
    new PrismaClient({
        log: ['query', 'info', 'warn', 'error'], // optional
    })

// Do not disconnect in serverless, only reuse the client
if (process.env.NODE_ENV !== 'production') globalThis.prisma = prisma