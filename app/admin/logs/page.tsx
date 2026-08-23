import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { AdminNav } from '@/components/admin/admin-nav'
import { LogsView } from '@/components/admin/logs-view'
import { getPickUrgency } from '@/lib/pick'

export const dynamic = 'force-dynamic'

// Transparent at the very top, fully opaque by 10vh.
const FADE = 'linear-gradient(to bottom, transparent 0, #000 calc(10 * var(--vh)))'

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

    // The nav and the Logs label sit OUTSIDE the scroller on purpose. The
    // scroller carries a mask-image, and a masked element becomes the
    // containing block for any fixed-position descendant — nesting them would
    // silently un-pin both.
    return (
        <>
            <AdminNav active="logs" variant="top-left" pickUrgency={pickUrgency} />
            <span className="hidden md:block fixed top-3 right-3 z-[300] text-[8pt] font-bold underline decoration-2 underline-offset-3">
                Logs
            </span>
            <div
                className="absolute inset-0 bg-white overflow-auto"
                style={{
                    // Rows dissolve over the top 10vh as they scroll up under
                    // the nav. --vh rather than raw vh to match the rest of the
                    // app; on admin they resolve the same, but the convention
                    // holds if this ever renders zoomed.
                    maskImage: FADE,
                    WebkitMaskImage: FADE,
                }}
            >
                <LogsView logs={logs} colorById={colorById} />
            </div>
        </>
    )
}
