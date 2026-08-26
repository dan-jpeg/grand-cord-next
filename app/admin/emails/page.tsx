import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { AdminNav } from '@/components/admin/admin-nav'
import { EmailsView } from '@/components/admin/emails-view'
import { getPickUrgency } from '@/lib/pick'

export const dynamic = 'force-dynamic'

// Transparent at the very top, fully opaque by 10vh.
const FADE = 'linear-gradient(to bottom, transparent 0, #000 calc(10 * var(--vh)))'

export default async function AdminEmailsPage() {
    const session = await auth()
    if (!session) {
        redirect('/admin/login')
    }

    // Orders rather than OrderEmail rows, because the question this screen
    // answers is "was this customer told?" — and the alarming answer is an
    // absent row, which a log of rows cannot show.
    const [orders, pickUrgency] = await Promise.all([
        prisma.order.findMany({
            orderBy: { createdAt: 'desc' },
            take: 200,
            select: {
                id: true,
                orderNumber: true,
                email: true,
                status: true,
                createdAt: true,
                emails: {
                    select: { kind: true, status: true, error: true, createdAt: true },
                },
            },
        }),
        getPickUrgency(),
    ])

    // Nav and label sit OUTSIDE the scroller: it carries a mask-image, and a
    // masked element becomes the containing block for fixed-position
    // descendants, which would silently un-pin both.
    return (
        <>
            <AdminNav active="emails" variant="top-left" pickUrgency={pickUrgency} />
            <span className="hidden md:block fixed top-3 right-3 z-[300] text-[8pt] font-bold underline decoration-2 underline-offset-3">
                Emails
            </span>
            <div
                className="absolute inset-0 bg-white overflow-auto"
                style={{ maskImage: FADE, WebkitMaskImage: FADE }}
            >
                <EmailsView orders={orders} />
            </div>
        </>
    )
}
