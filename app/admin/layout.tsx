import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default async function AdminLayout({
                                              children,
                                          }: {
    children: React.ReactNode
}) {
    const session = await auth()

    if (!session) {
        redirect('/admin/login')
    }

    return (
        <div className="min-h-screen bg-neutral-50">
            <nav className="bg-white border-b border-neutral-200">
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <h1 className="text-xl font-bold">Admin Dashboard</h1>
                        <div className="flex items-center gap-6">
                            <span className="text-sm text-neutral-600">{session.user?.email}</span>
                            <form action={async () => {
                                'use server'
                                const { signOut } = await import('@/lib/auth')
                                await signOut()
                            }}>
                                <button className="text-sm hover:underline">Logout</button>
                            </form>
                        </div>
                    </div>
                </div>
            </nav>
            <main>{children}</main>
        </div>
    )
}