import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined }

// @ts-expect-error: Prisma 5 internal flag for serverless
export const prisma =
    globalForPrisma.prisma ??
    new PrismaClient({
      log: ['query', 'info', 'warn', 'error'],
      __internal: {
        usePreparedStatements: false,
      },
    })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma