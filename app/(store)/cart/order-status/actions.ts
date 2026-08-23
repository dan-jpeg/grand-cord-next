'use server'

import { prisma } from '@/lib/prisma'

/**
 * Public order lookup.
 *
 * The order number is an identifier, not a secret — it is sequential, printed
 * on receipts, and read out over the phone. The email is what proves the order
 * belongs to the person asking. Without it, counting from 0001 walks the whole
 * customer table.
 *
 * Both must match. A wrong pair returns null rather than saying which half was
 * wrong, so this cannot be used to test whether an address is a customer.
 */
export async function lookupOrder(orderNumber: string, email: string) {
    const number = orderNumber.trim()
    const address = email.trim().toLowerCase()

    if (!number || !address) return null

    const order = await prisma.order.findUnique({
        where: { orderNumber: number },
        include: { items: true },
    })

    if (!order) return null
    if (order.email.trim().toLowerCase() !== address) return null

    return order
}
