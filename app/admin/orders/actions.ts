'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

type OrderStatusUpdate = {
    status: 'PENDING' | 'PAID' | 'SHIPPED' | 'CANCELLED'
    trackingNumber?: string | null
    trackingUrl?: string | null
}

export async function updateOrderStatus(orderId: string, data: OrderStatusUpdate) {
    await prisma.order.update({
        where: { id: orderId },
        data: {
            status: data.status,
            trackingNumber: data.trackingNumber,
            trackingUrl: data.trackingUrl,
        },
    })

    revalidatePath('/admin/orders')
    revalidatePath(`/admin/orders/${orderId}`)
}

