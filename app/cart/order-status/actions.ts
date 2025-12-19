'use server'

import { prisma } from '@/lib/prisma'

export async function lookupOrder(orderNumber: string) {
    const order = await prisma.order.findUnique({
        where: { orderNumber },
        include: { items: true },
    })

    return order
}