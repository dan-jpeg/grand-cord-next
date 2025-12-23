'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { formatPrice } from '@/lib/utils'
import type { Order, OrderItem } from '@prisma/client'

type OrderWithItems = Order & {
    items: OrderItem[]
}

type SortOption = 'date-desc' | 'date-asc' | 'total-desc' | 'total-asc'
type StatusFilter = 'ALL' | 'PENDING' | 'PAID' | 'SHIPPED' | 'CANCELLED'

export function OrdersList({ orders }: { orders: OrderWithItems[] }) {
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL')
    const [sortBy, setSortBy] = useState<SortOption>('date-desc')

    const filteredAndSortedOrders = useMemo(() => {
        let filtered = orders

        // Filter by search (order number or email)
        if (search) {
            filtered = filtered.filter(
                (order) =>
                    order.orderNumber.toLowerCase().includes(search.toLowerCase()) ||
                    order.email.toLowerCase().includes(search.toLowerCase())
            )
        }

        // Filter by status
        if (statusFilter !== 'ALL') {
            filtered = filtered.filter((order) => order.status === statusFilter)
        }

        // Sort
        const sorted = [...filtered].sort((a, b) => {
            switch (sortBy) {
                case 'date-desc':
                    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                case 'date-asc':
                    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
                case 'total-desc':
                    return b.total - a.total
                case 'total-asc':
                    return a.total - b.total
                default:
                    return 0
            }
        })

        return sorted
    }, [orders, search, statusFilter, sortBy])

    return (
        <div className="space-y-6">
            {/* Controls */}
            <div className="space-y-4">
                {/* Search */}
                <div>
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search order # or email..."
                        className="w-full px-4 py-2 border-2 border-black text-[9pt] focus:outline-none"
                    />
                </div>

                {/* Filters and Sort */}
                <div className="flex items-center justify-between gap-4">
                    {/* Status Filters */}
                    <div className="flex gap-2">
                        {(['ALL', 'PENDING', 'PAID', 'SHIPPED', 'CANCELLED'] as StatusFilter[]).map(
                            (status) => (
                                <button
                                    key={status}
                                    onClick={() => setStatusFilter(status)}
                                    className={`px-3 py-1 text-[9pt] font-bold uppercase border-2 border-black ${
                                        statusFilter === status
                                            ? 'bg-black text-white'
                                            : 'bg-white text-black hover:bg-neutral-100'
                                    }`}
                                >
                                    {status}
                                </button>
                            )
                        )}
                    </div>

                    {/* Sort */}
                    <div className="flex items-center gap-2">
                        <span className="text-[9pt] font-bold uppercase">SORT:</span>
                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value as SortOption)}
                            className="px-3 py-1 text-[9pt] font-bold uppercase border-2 border-black bg-white"
                        >
                            <option value="date-desc">Newest First</option>
                            <option value="date-asc">Oldest First</option>
                            <option value="total-desc">Highest Total</option>
                            <option value="total-asc">Lowest Total</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Results Count */}
            <div className="text-[9pt] font-bold">
                {filteredAndSortedOrders.length} {filteredAndSortedOrders.length === 1 ? 'ORDER' : 'ORDERS'}
            </div>

            {/* Orders List */}
            <div className="space-y-1">
                {filteredAndSortedOrders.length === 0 ? (
                    <div className="py-8 text-center text-[9pt] text-neutral-500">
                        No orders found
                    </div>
                ) : (
                    filteredAndSortedOrders.map((order) => (
                        <Link
                            key={order.id}
                            href={`/admin/orders/${order.id}`}
                            className="flex items-center justify-between py-3 border-b border-neutral-200 text-[9pt] hover:bg-neutral-50 transition-colors"
                        >
                            <div className="flex-1 font-bold">{order.orderNumber}</div>
                            <div className="w-48 truncate">{order.email}</div>
                            <div className="w-24">{order.items.length} items</div>
                            <div className="w-32">{formatPrice(order.total)}</div>
                            <div
                                className={`w-24 uppercase font-bold ${
                                    order.status === 'PAID'
                                        ? 'text-green-700'
                                        : order.status === 'SHIPPED'
                                            ? 'text-blue-700'
                                            : order.status === 'CANCELLED'
                                                ? 'text-red-700'
                                                : 'text-neutral-700'
                                }`}
                            >
                                {order.status}
                            </div>
                            <div className="w-32 text-neutral-600">
                                {new Date(order.createdAt).toLocaleDateString()}
                            </div>
                        </Link>
                    ))
                )}
            </div>
        </div>
    )
}