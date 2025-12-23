import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'

export default async function AdminDashboard() {
    const session = await auth()

    if (!session) {
        redirect('/admin/login')
    }

    const ordersCount = await prisma.order.count({ where: { status: 'PAID' } })

    return (
        <>
            {/* Header */}
            <div className="absolute top-6 left-8">
                <div className="text-[9pt] font-bold leading-none">
                    GRAND-CORD
                    <br />
                    EDITOR
                </div>
            </div>

            {/* Navigation */}
            <div className="absolute top-1/2 left-0 right-0 -translate-y-1/2 flex  justify-between px-12">
                <Link
                    href="/admin/products"
                    className="text-[9pt] font-bold uppercase hover:underline"
                >
                    INVENTORY
                </Link>
                <Link
                    href="/admin/products"
                    className="text-[9pt] font-bold uppercase hover:underline"
                >
                    CATALOG
                </Link>
                <Link
                    href="/admin/orders"
                    className="text-[9pt] font-bold uppercase hover:underline"
                >
                    ORDERS {ordersCount > 0 && `(${ordersCount} to fulfill)`}
                </Link>
                <Link
                    href="/admin/orders"
                    className="text-[9pt] font-bold uppercase hover:underline"
                >
                    PAYMENTS
                </Link>
            </div>

            {/* Footer */}
            <div className="absolute bottom-6 left-0 right-0 flex justify-between px-12 items-center">
                <div className="text-[9pt] font-bold uppercase">
                    MORE
                    <span className="ml-2">▼</span>
                </div>
                <Link
                    href="/"
                    className="text-[9pt] font-bold uppercase hover:underline flex items-center gap-2"
                >
                    <span>▶</span> TO PUBLIC SITE
                </Link>
            </div>
        </>
    )
}