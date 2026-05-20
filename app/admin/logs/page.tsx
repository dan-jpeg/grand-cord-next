import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { AdminNav } from '@/components/admin/admin-nav'
import { LogsView } from '@/components/admin/logs-view'
import { getPickUrgency } from '@/lib/pick'

export const dynamic = 'force-dynamic'

export default async function AdminLogsPage() {
    const session = await auth()
    if (!session) {
        redirect('/admin/login')
    }

    const [logs, pickUrgency] = await Promise.all([
        prisma.inventoryChangeLog.findMany({
            orderBy: { createdAt: 'desc' },
            take: 500,
        }),
        getPickUrgency(),
    ])

    const productIds = Array.from(
        new Set(logs.map((l) => l.productId).filter((id): id is string => !!id)),
    )
    const products = productIds.length
        ? await prisma.product.findMany({
              where: { id: { in: productIds } },
              select: { id: true, color: true },
          })
        : []
    const colorById: Record<string, string | null> = Object.fromEntries(
        products.map((p) => [p.id, p.color]),
    )

    return (
        <div className="absolute inset-0 bg-white overflow-auto">
            <AdminNav active="logs" variant="top-left" pickUrgency={pickUrgency} />
            <span className="hidden md:block absolute top-3 right-3 z-[300] text-[8pt] font-bold underline decoration-2 underline-offset-3">
                Logs
            </span>
            <LogsView logs={logs} colorById={colorById} />
        </div>
    )
}
