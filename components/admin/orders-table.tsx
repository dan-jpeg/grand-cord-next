'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { formatPrice } from '@/lib/utils'
import type { Order, OrderItem } from '@prisma/client'

type OrderWithItems = Order & {
    items: OrderItem[]
}

type StatusFilter = 'ALL' | 'SHIPPED' | 'PENDING' | 'PAID' | 'CANCELLED'

const ITEMS_PER_PAGE = 15

// Status colors - edit these to change the square colors
const STATUS_COLORS = {
    PAID: '#10b981',      // green
    PENDING: '#f59e0b',   // orange
    SHIPPED: '#3b82f6',   // blue
    CANCELLED: '#ef4444', // red
}

export function OrdersTable({ orders }: { orders: OrderWithItems[] }) {
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL')
    const [currentPage, setCurrentPage] = useState(1)

    const filteredOrders = useMemo(() => {
        let filtered = orders

        // Search filter
        if (search) {
            filtered = filtered.filter(
                (order) =>
                    order.orderNumber.toLowerCase().includes(search.toLowerCase()) ||
                    order.email.toLowerCase().includes(search.toLowerCase())
            )
        }

        // Status filter
        if (statusFilter !== 'ALL') {
            filtered = filtered.filter((order) => order.status === statusFilter)
        }

        return filtered
    }, [orders, search, statusFilter])

    const totalPages = Math.ceil(filteredOrders.length / ITEMS_PER_PAGE)
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
    const paginatedOrders = filteredOrders.slice(startIndex, startIndex + ITEMS_PER_PAGE)

    return (
        <div className="space-y-6 max-w-[1381px] mx-auto text-[8pt]">
            {/* Search */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex-1 relative">
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => {
                            setSearch(e.target.value)
                            setCurrentPage(1)
                        }}
                        className="absolute inset-0 opacity-0 cursor-default"
                        autoFocus
                    />

                    <div className="pointer-events-none">
                        {search ? (
                            <div className="font-bold">■ {search}</div>
                        ) : (
                            <div>■ Start Typing to Search By Order Number or Order E-Mail</div>
                        )}
                    </div>
                </div>
            </div>

            {/* Table with Status Filters */}
            <div className="text-[8pt] border-black">
                {/* Status Filter Row */}
                <div className="flex items-center justify-end gap-4 px-4 py-2 border-b border-black  lowercase ">
                    {(['ALL', 'SHIPPED', 'PENDING', 'PAID', 'CANCELLED'] as StatusFilter[]).map((status) => (
                        <button
                            key={status}
                            onClick={() => {
                                setStatusFilter(status)
                                setCurrentPage(1)
                            }}
                            className={`flex items-center lowercase gap-2 ${statusFilter === status ? 'underline' : 'hover:underline'}`}
                        >
                            {status !== 'ALL' && (
                                <span
                                    className="w-2 h-2 inline-block"
                                    style={{ backgroundColor: STATUS_COLORS[status as keyof typeof STATUS_COLORS] }}
                                />
                            )}
                            {status}
                        </button>
                    ))}
                </div>

                {/* Order Rows */}
                {paginatedOrders.map((order, index) => {
                    const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0)
                    const displayIndex = startIndex + index + 1

                    return (
                        <Link
                            key={order.id}
                            href={`/admin/orders/${order.id}`}
                            className={`grid items-center px-4 py-2 border-r  border-l-[2px] hover:border-b-[2px] hover:border-l-[3px] border-b border-black  transition-border
                                grid-cols-[auto_auto_1fr_auto]
                                lg:grid-cols-[1fr_3fr_4fr_5fr_3fr_5fr_3fr_3fr_4fr]
                                ${index % 2 === 0 ? 'bg-white' : 'bg-white'}
                            `}
                        >
                            {/* Square + Index - Mobile */}
                            <div className="lg:hidden flex items-center gap-2">
                                <span
                                    className="w-2 h-2 inline-block"
                                    style={{ backgroundColor: STATUS_COLORS[order.status as keyof typeof STATUS_COLORS] }}
                                />
                                <span className="">{displayIndex}.</span>
                            </div>

                            {/* Order Number - Mobile */}
                            <div className=" lg:hidden">{order.orderNumber}</div>

                            {/* Status - Mobile */}
                            <div className=" uppercase lg:hidden">{order.status}</div>

                            {/* Date - Mobile */}
                            <div className="text-right lg:hidden">
                                {new Date(order.createdAt).toLocaleDateString('en-US', {
                                    month: '2-digit',
                                    day: '2-digit',
                                    year: 'numeric',
                                })}
                            </div>

                            {/* Desktop Layout */}
                            <div className="hidden lg:block ">{displayIndex}.</div>
                            <div className="hidden lg:block truncate ">{order.orderNumber}</div>
                            <div className="hidden lg:block"></div>
                            <div className="hidden lg:block"></div>
                            <div className="hidden lg:block lowercase italic truncate">{order.email}</div>
                            <div className="hidden lg:block text-right items-right mr-4 font-bold">{itemCount} item(s)</div>
                            <div className="hidden lg:block ">{formatPrice(order.total)}</div>
                            <div className="hidden lg:flex  uppercase items-center gap-2">
                                <span
                                    className="w-2 h-2 inline-block"
                                    style={{ backgroundColor: STATUS_COLORS[order.status as keyof typeof STATUS_COLORS] }}
                                />
                                {order.status}
                            </div>
                            <div className="hidden lg:block text-right">
                                {new Date(order.createdAt).toLocaleDateString('en-US', {
                                    month: '2-digit',
                                    day: '2-digit',
                                    year: 'numeric',
                                })}
                            </div>
                        </Link>
                    )
                })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-end gap-2 text-sm">
                    <button
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="disabled:opacity-30"
                    >
                        &lt;
                    </button>
                    <span className="font-bold">
                        Page {currentPage}/{totalPages}
                    </span>
                    <button
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="disabled:opacity-30"
                    >
                        &gt;
                    </button>
                </div>
            )}
        </div>
    )
}
