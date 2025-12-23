'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function updateOrderStatus(
    orderId: string,
    status: 'PENDING' | 'PAID' | 'SHIPPED' | 'CANCELLED',
    trackingNumber?: string,
    trackingUrl?: string
) {
    const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: { items: true },
    })

    if (!order) throw new Error('Order not found')

    const previousStatus = order.status

    // Update order status
    await prisma.order.update({
        where: { id: orderId },
        data: {
            status,
            // Clear tracking if not SHIPPED
            trackingNumber: status === 'SHIPPED' ? (trackingNumber || order.trackingNumber) : null,
            trackingUrl: status === 'SHIPPED' ? (trackingUrl || order.trackingUrl) : null,
        },
    })

    // Handle inventory changes based on status transition
    if (previousStatus === 'PAID' && status === 'SHIPPED') {
        // Order shipped: decrement committed and total
        for (const item of order.items) {
            await prisma.productSize.updateMany({
                where: {
                    productId: item.productId,
                    size: item.size,
                },
                data: {
                    committed: {
                        decrement: item.quantity,
                    },
                    total: {
                        decrement: item.quantity,
                    },
                },
            })
        }
    }

    if (previousStatus !== 'CANCELLED' && status === 'CANCELLED') {
        // Only restore inventory if order hasn't been shipped yet
        if (previousStatus === 'PENDING' || previousStatus === 'PAID') {
            // Order cancelled before shipping: move from committed back to available
            for (const item of order.items) {
                await prisma.productSize.updateMany({
                    where: {
                        productId: item.productId,
                        size: item.size,
                    },
                    data: {
                        committed: {
                            decrement: item.quantity,
                        },
                        available: {
                            increment: item.quantity,
                        },
                    },
                })
            }
        }
        // If previousStatus was SHIPPED, inventory is already gone - don't restore
    }

    revalidatePath('/admin/orders')
    revalidatePath(`/admin/orders/${orderId}`)
    revalidatePath('/admin/products')
    redirect('/admin/orders')
}