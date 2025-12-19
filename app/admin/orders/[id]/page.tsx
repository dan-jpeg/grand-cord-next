import { prisma } from '@/lib/prisma'
import { formatPrice } from '@/lib/utils'
import Link from 'next/link'

type OrderStatus = 'PENDING' | 'PAID' | 'SHIPPED' | 'CANCELLED'

export default async function OrdersPage({
                                             searchParams,
                                         }: {
    searchParams: Promise<{ status?: OrderStatus }>
}) {
    const { status } = await searchParams

    const orders = await prisma.order.findMany({
        where: status ? { status } : undefined,
        include: {
            items: true,
        },
        orderBy: {
            createdAt: 'desc',
        },
    })

    const statusCounts = await Promise.all([
        prisma.order.count({ where: { status: 'PAID' } }),
        prisma.order.count({ where: { status: 'SHIPPED' } }),
        prisma.order.count({ where: { status: 'PENDING' } }),
        prisma.order.count({ where: { status: 'CANCELLED' } }),
    ])

    const [paidCount, shippedCount, pendingCount, cancelledCount] = statusCounts

    return (
        <div className="max-w-7xl mx-auto px-6 py-8">
            <h2 className="text-2xl font-bold mb-8">Orders</h2>

            {/* Status Filter Tabs */}
            <div className="flex gap-4 mb-6 border-b border-neutral-200">
                <StatusTab href="/admin/orders" label="All" count={orders.length} active={!status} />
                <StatusTab href="/admin/orders?status=PAID" label="To Fulfill" count={paidCount} active={status === 'PAID'} />
                <StatusTab href="/admin/orders?status=SHIPPED" label="Shipped" count={shippedCount} active={status === 'SHIPPED'} />
                <StatusTab href="/admin/orders?status=PENDING" label="Pending" count={pendingCount} active={status === 'PENDING'} />
                <StatusTab href="/admin/orders?status=CANCELLED" label="Cancelled" count={cancelledCount} active={status === 'CANCELLED'} />
            </div>

            {orders.length === 0 ? (
                <div className="bg-white border border-neutral-200 p-12 text-center">
                    <p className="text-neutral-600">No orders {status ? `with status "${status}"` : 'yet'}</p>
                </div>
            ) : (
                <div className="bg-white border border-neutral-200">
                    <table className="w-full">
                        <thead className="border-b border-neutral-200">
                        <tr>
                            <th className="text-left p-4 font-medium">Order</th>
                            <th className="text-left p-4 font-medium">Customer</th>
                            <th className="text-left p-4 font-medium">Items</th>
                            <th className="text-left p-4 font-medium">Total</th>
                            <th className="text-left p-4 font-medium">Status</th>
                            <th className="text-left p-4 font-medium">Date</th>
                            <th className="text-right p-4 font-medium">Actions</th>
                        </tr>
                        </thead>
                        <tbody>
                        {orders.map((order) => (
                            <tr key={order.id} className="border-b border-neutral-200 last:border-0">
                                <td className="p-4">
                                    <div className="font-medium">{order.orderNumber}</div>
                                </td>
                                <td className="p-4 text-neutral-600">{order.email}</td>
                                <td className="p-4">{order.items.length} items</td>
                                <td className="p-4 font-medium">{formatPrice(order.total)}</td>
                                <td className="p-4">
                                    <StatusBadge status={order.status} />
                                </td>
                                <td className="p-4 text-neutral-600">
                                    {new Date(order.createdAt).toLocaleDateString()}
                                </td>
                                <td className="p-4">
                                    <Link
                                        href={`/admin/orders/${order.id}`}
                                        className="text-sm underline hover:no-underline text-right block"
                                    >
                                        View Details
                                    </Link>
                                </td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}

function StatusTab({
                       href,
                       label,
                       count,
                       active,
                   }: {
    href: string
    label: string
    count: number
    active: boolean
}) {
    return (
        <Link
            href={href}
            className={`px-4 py-3 font-medium border-b-2 transition-colors ${
                active
                    ? 'border-black'
                    : 'border-transparent hover:border-neutral-300'
            }`}
        >
            {label} ({count})
        </Link>
    )
}

function StatusBadge({ status }: { status: string }) {
    const colors = {
        PENDING: 'bg-yellow-100 text-yellow-800',
        PAID: 'bg-blue-100 text-blue-800',
        SHIPPED: 'bg-green-100 text-green-800',
        CANCELLED: 'bg-red-100 text-red-800',
    }

    return (
        <span className={`inline-block px-2 py-1 text-xs font-medium ${colors[status as keyof typeof colors]}`}>
      {status.toLowerCase()}
    </span>
    )
}