'use client'

import Link from 'next/link'
import type { InventoryChangeLog } from '@prisma/client'

export function LogsView({
    logs,
    colorById,
}: {
    logs: InventoryChangeLog[]
    colorById: Record<string, string | null>
}) {
    // Top padding matches the fade distance so that at rest the newest row sits
    // clear of both the mask and the pinned nav — the fade should only bite once
    // you actually scroll.
    return (
        <div className="min-h-[calc(100*var(--vh))] flex flex-col justify-end pt-[calc(11*var(--vh))] pb-3">
            <div>
                {logs.map((log) => (
                    <LogRow
                        key={log.id}
                        log={log}
                        color={log.productId ? colorById[log.productId] ?? null : null}
                    />
                ))}
            </div>
        </div>
    )
}

const ROW_GRID_STYLE: React.CSSProperties = {
    gridTemplateColumns:
        '170px minmax(0,1fr) 140px 140px 100px 60px minmax(0,1fr) 140px',
}

function LogRow({
    log,
    color,
}: {
    log: InventoryChangeLog
    color: string | null
}) {
    // Manual product-screen edits have no reason; order-driven rows name the order.
    // The o- prefix marks the bare digits as an order number; the em-dash
    // fallback stays unprefixed since there is no number to label.
    const orderRef = log.orderNumber ? `o-${log.orderNumber}` : '—'
    const causeText =
        log.reason === 'ORDER_SHIPPED'
            ? `Shipped: ${orderRef}`
            : log.reason === 'ORDER_CANCELLED'
              ? `Cancelled: ${orderRef}`
              : log.reason === 'ORDER_UNSHIPPED'
                ? `Un-shipped: ${orderRef}`
                : null

    const deltaText = (
        <span
            className="whitespace-nowrap text-right tabular-nums"
            style={{ color: '#747474', fontFamily: 'ReformatMono, monospace', fontWeight: 700 }}
        >
            {log.delta > 0 ? '+' : '−'} {Math.abs(log.delta)}
        </span>
    )

    const row = (
        <div className="group relative w-full px-3 py-[10px] text-[12px] text-black">
            {/* Hover strikethrough — 0.5px line through the middle */}
            <span
                aria-hidden
                className="pointer-events-none absolute left-0 right-0 top-1/2 -translate-y-1/2 bg-black opacity-0 group-hover:opacity-100"
                style={{ height: '0.5px' }}
            />

            {/* ── Mobile: two stacked rows ── */}
            <div className="md:hidden flex flex-col gap-1">
                <div className="flex items-center gap-3">
                    <span className="font-reformat whitespace-nowrap truncate">
                        Item: {log.productName}
                    </span>
                    <span className="font-reformat whitespace-nowrap truncate">
                        Color: {color ?? '—'}
                    </span>
                    <span className="font-reformat whitespace-nowrap">
                        Size: {log.sizeLabel}
                    </span>
                    <span className="flex-1" />
                    {deltaText}
                </div>
                <div className="flex items-center justify-between gap-3">
                    <span className="font-reformat tabular-nums whitespace-nowrap">
                        <Timestamp createdAt={log.createdAt} />
                    </span>
                    {causeText && (
                        <span className="font-reformat whitespace-nowrap truncate opacity-60">
                            {causeText}
                        </span>
                    )}
                    <span className="font-reformat whitespace-nowrap">
                        {log.adminName || 'Admin'}
                    </span>
                </div>
            </div>

            {/* ── Desktop: single grid row ── */}
            <div
                className="hidden md:grid items-center w-full text-[12px] text-black"
                style={ROW_GRID_STYLE}
            >
                <span className="font-reformat tabular-nums whitespace-nowrap">
                    <Timestamp createdAt={log.createdAt} />
                </span>

                <span />

                <span className="font-reformat whitespace-nowrap">
                    Item: {log.productName}
                </span>

                <span className="font-reformat whitespace-nowrap">
                    Color: {color ?? '—'}
                </span>

                <span className="font-reformat whitespace-nowrap">
                    Size: {log.sizeLabel}
                </span>

                {deltaText}

                <span className="font-reformat whitespace-nowrap truncate opacity-60 pl-4">
                    {causeText ?? ''}
                </span>

                <span className="font-reformat whitespace-nowrap text-right">
                    {log.adminName || 'Admin'}
                </span>
            </div>
        </div>
    )

    if (log.productId) {
        return (
            <Link href={`/admin/products/${log.productId}/edit`} className="block">
                {row}
            </Link>
        )
    }
    return row
}

function Timestamp({ createdAt }: { createdAt: Date | string }) {
    const created = typeof createdAt === 'string' ? new Date(createdAt) : createdAt
    const time = `${created.getHours()}h${pad(created.getMinutes())}m`
    const date = `${pad(created.getDate())}:${pad(created.getMonth() + 1)}:${pad(created.getFullYear() % 100)}`
    return (
        <>
            {time} {date}
        </>
    )
}

function pad(n: number) {
    return n.toString().padStart(2, '0')
}
