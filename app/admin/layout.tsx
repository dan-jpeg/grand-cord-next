import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export default async function AdminLayout({
                                              children,
                                          }: {
    children: React.ReactNode
}) {
    let session

    try {
        session = await auth()
    } catch (error) {
        console.error('Auth error:', error)
        session = null
    }

    if (!session) {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center">
                {children}
            </div>
        )
    }

    return (
        <div className="min-h-screen max-w-screen-2xl max bg-white">
            {children}
        </div>
    )
}