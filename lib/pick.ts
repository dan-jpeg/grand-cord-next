import { prisma } from '@/lib/prisma'

export async function getPickUrgency(): Promise<string | null> {
    const orders = await prisma.order.findMany({
        where: { status: 'PAID' },
        select: { createdAt: true },
    })
    if (orders.length === 0) return null

    const now = Date.now()
    const days = orders.map(o => (now - new Date(o.createdAt).getTime()) / (1000 * 60 * 60 * 24))

    if (days.some(d => d > 7)) return '#ef4444'
    if (days.some(d => d >= 3)) return '#eab308'
    return '#3b82f6'
}
