'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { formatPrice } from '@/lib/utils'
import type { Order, OrderItem, OrderStatus } from '@prisma/client'

type OrderWithItems = Order & {
    items: OrderItem[]
}

type StatusFilter = 'ALL' | OrderStatus

const ITEMS_PER_PAGE = 15

// Status colors - edit these to change the square colors
const STATUS_COLORS = {
    PAID: '#10b981',      // green
    PENDING: '#f59e0b',   // orange
    SHIPPED: '#3b82f6',   // blue
    CANCELLED: '#ef4444', // red
}

/**
 * The filter options, in display order. ALL is the unfiltered state.
 *
 * One list for both views: the desktop row renders it, the mobile Filter button
 * cycles through it. They were previously separate literals and had already
 * drifted — CANCELLED existed on desktop but not in the cycle, so a filter the
 * desktop could reach left the mobile button with nothing to advance from
 * (indexOf returned -1 and it snapped back to ALL). Both views share one
 * statusFilter, so they have to offer the same set.
 */
const ORDER_STATUS_FILTERS: StatusFilter[] = ['ALL', 'SHIPPED', 'PENDING', 'PAID', 'CANCELLED']

function MobileOrdersView({
    orders,
    productImages,
    statusFilter,
    setStatusFilter,
    search,
    setSearch,
}: {
    orders: OrderWithItems[]
    productImages: Record<string, string>
    statusFilter: StatusFilter
    setStatusFilter: (s: StatusFilter) => void
    search: string
    setSearch: (s: string) => void
}) {
    const [showImages, setShowImages] = useState(false)
    const [sortDesc, setSortDesc] = useState(true)
    const [searchOpen, setSearchOpen] = useState(false)

    const sorted = useMemo(
        () =>
            [...orders].sort((a, b) =>
                sortDesc
                    ? +new Date(b.createdAt) - +new Date(a.createdAt)
                    : +new Date(a.createdAt) - +new Date(b.createdAt),
            ),
        [orders, sortDesc],
    )

    const cycleFilter = () => {
        const i = ORDER_STATUS_FILTERS.indexOf(statusFilter)
        setStatusFilter(ORDER_STATUS_FILTERS[(i + 1) % ORDER_STATUS_FILTERS.length])
    }

    const fmtDate = (d: Date | string) =>
        new Date(d).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit' })

    const fmtStatus = (s: string) => s.charAt(0) + s.slice(1).toLowerCase()

    return (
        // Top-anchored layout: the eye · Orders nav sits top-left with Sort /
        // Filter top-right, Search and Show Images right-aligned below, then the
        // order rows fill the rest. Matches Figma node 1718:2874.
        <div className="lg:hidden fixed inset-0 z-[100] bg-white flex flex-col text-[12px] font-bold">
            {/* Header cluster. The eye · Orders nav on the left is supplied by
                <AdminNav> (MobileEyeHub, top-left) — we only render the
                right-aligned Sort / Filter controls here. */}
            <div className="shrink-0 px-[12px] pt-[8px]">
                <div className="flex items-center justify-end gap-[26px] pr-[2px]">
                    <button
                        type="button"
                        onClick={() => setSortDesc((v) => !v)}
                        className={`px-[11px] py-[7px] leading-none ${!sortDesc ? 'bg-[#d9d9d9]/40' : ''}`}
                    >
                        Sort
                    </button>
                    <button
                        type="button"
                        onClick={cycleFilter}
                        className={`px-[11px] py-[7px] leading-none ${statusFilter !== 'ALL' ? 'bg-[#d9d9d9]/40' : ''}`}
                    >
                        {statusFilter === 'ALL' ? 'Filter' : fmtStatus(statusFilter)}
                    </button>
                </div>

                {/* Search — right-aligned, dropped below the header. */}
                <div className="flex justify-end pr-[2px] pt-[120px]">
                    <button type="button" onClick={() => setSearchOpen((v) => !v)}>
                        Search
                    </button>
                </div>

                {searchOpen && (
                    <input
                        autoFocus
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        onBlur={() => { if (!search.trim()) setSearchOpen(false) }}
                        placeholder="Order number or e-mail"
                        className="w-full mt-3 bg-[#d9d9d9]/20 px-2 py-1 text-[12px] font-bold outline-none"
                    />
                )}

                {/* Show / Hide Images — right-aligned, faded. */}
                <div className="flex justify-end pr-[2px] pt-[8px] pb-[10px]">
                    <button
                        type="button"
                        onClick={() => setShowImages((v) => !v)}
                        className="opacity-[0.32]"
                    >
                        {showImages ? 'Hide Images' : 'Show Images'}
                    </button>
                </div>
            </div>

            {/* Order rows — fill the rest, scrollable. Alternating grey blocks;
                each block is the text row plus (when shown) its images. */}
            <div className="flex-1 overflow-y-auto px-[12px]">
                {sorted.map((order, index) => (
                    <Link
                        key={order.id}
                        href={`/admin/orders/${order.id}`}
                        className={`block ${index % 2 === 0 ? 'bg-[#d9d9d9]/20' : 'bg-white'}`}
                    >
                        <div className="grid grid-cols-3 px-[7px] items-center h-[36px]">
                            <span>{order.orderNumber.startsWith('O-') ? order.orderNumber : `O-${order.orderNumber}`}</span>
                            <span className="text-center">{fmtStatus(order.status)}</span>
                            <span className="text-right">{fmtDate(order.createdAt)}</span>
                        </div>
                        <div
                            className={`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out ${showImages ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
                        >
                            <div className="overflow-hidden">
                                <div className="grid grid-cols-3 px-[7px] items-end gap-y-3 pb-4">
                                    {order.items.map((item, i) => {
                                        const src = productImages[item.productId]
                                        return (
                                            <span key={item.id} className={`flex h-[56px] items-end ${i % 3 === 1 ? 'justify-center' : i % 3 === 2 ? 'justify-end' : 'justify-start'}`}>
                                                {src ? (
                                                    // eslint-disable-next-line @next/next/no-img-element
                                                    <img
                                                        src={src}
                                                        alt={item.productName}
                                                        draggable={false}
                                                        className="max-h-full max-w-[48px] object-contain"
                                                    />
                                                ) : (
                                                    <span className="text-neutral-300">—</span>
                                                )}
                                            </span>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    )
}

export function OrdersTable({
    orders,
    productImages = {},
}: {
    orders: OrderWithItems[]
    productImages?: Record<string, string>
}) {
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
        <>
        <MobileOrdersView
            orders={filteredOrders}
            productImages={productImages}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            search={search}
            setSearch={setSearch}
        />
        <div className="hidden lg:block space-y-6 max-w-[1381px] mx-auto text-[8pt]">
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
                    {ORDER_STATUS_FILTERS.map((status) => (
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
                                gap-x-3 lg:gap-x-0
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
        </>
    )
}
