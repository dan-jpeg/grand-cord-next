import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { AdminNav } from '@/components/admin/admin-nav'
import { MembersView } from '@/components/admin/members-view'
import { getPickUrgency } from '@/lib/pick'

export const dynamic = 'force-dynamic'

export default async function AdminMembersPage() {
    const session = await auth()
    if (!session?.user) {
        redirect('/admin/login')
    }

    const [members, pickUrgency] = await Promise.all([
        prisma.adminUser.findMany({
            orderBy: { createdAt: 'asc' },
            select: { id: true, email: true, name: true, createdAt: true },
        }),
        getPickUrgency(),
    ])

    return (
        <div className="absolute inset-0 bg-white overflow-auto">
            <AdminNav active="members" variant="centered" pickUrgency={pickUrgency} />
            <div className="w-full px-16 py-12">
                <MembersView members={members} currentUserId={session.user.id as string} />
            </div>
        </div>
    )
}
