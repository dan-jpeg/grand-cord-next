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

    // Explicit fields: the whole row used to go to the browser, including
    // `stripePaymentIntentId` and internal `notes`. A customer needs neither.
    const order = await prisma.order.findUnique({
        where: { orderNumber: number },
        select: {
            orderNumber: true,
            email: true,
            status: true,
            total: true,
            shippingAddress: true,
            trackingNumber: true,
            trackingUrl: true,
            createdAt: true,
            items: {
                select: {
                    id: true,
                    productName: true,
                    productSlug: true,
                    size: true,
                    quantity: true,
                    price: true,
                },
            },
        },
    })

    if (!order) return null
    if (order.email.trim().toLowerCase() !== address) return null

    return order
}
