import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'

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
                <div className="max-w-7xl mx-auto px-4 py-4">
                    <h1 className="text-sm font-bold">Admin Dashboard</h1>
                </div>
            </nav>
            <main className="max-w-7xl mx-auto p-8">{children}</main>
        </div>
    )
}