'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import type { OrderEmailKind, OrderEmailStatus, OrderStatus } from '@prisma/client'
import { resendOrderEmailAction } from '@/app/admin/emails/actions'
import {
    ALLOWED_BY_STATUS,
    EXPECTED_BY_STATUS,
    KIND_LABELS,
    KIND_ORDER,
} from '@/lib/email/policy'
import { STOCK_COLORS } from '@/lib/constants'

export type EmailRow = {
    kind: OrderEmailKind
    status: OrderEmailStatus
    error: string | null
    createdAt: Date | string
}

export type OrderEmailSummary = {
    id: string
    orderNumber: string
    email: string
    status: OrderStatus
    createdAt: Date | string
    emails: EmailRow[]
}

export function EmailsView({ orders }: { orders: OrderEmailSummary[] }) {
    return (
        <div className="min-h-[calc(100*var(--vh))] flex flex-col justify-end pt-[calc(11*var(--vh))] pb-3">
            <div>
                {orders.map((order) => (
                    <OrderRow key={order.id} order={order} />
                ))}
                {orders.length === 0 && (
                    <div className="px-3 py-[10px] text-[12px] opacity-60">No orders yet.</div>
                )}
            </div>
        </div>
    )
}

const ROW_GRID_STYLE: React.CSSProperties = {
    gridTemplateColumns: '170px 80px 90px minmax(0,1fr) 200px 200px 200px',
}

function OrderRow({ order }: { order: OrderEmailSummary }) {
    const byKind = new Map(order.emails.map((e) => [e.kind, e]))

    const cells = KIND_ORDER.map((kind) => (
        <Slot key={kind} order={order} kind={kind} row={byKind.get(kind) ?? null} />
    ))

    return (
        <div className="group relative w-full px-3 py-[10px] text-[12px] text-black">
            <span
                aria-hidden
                className="pointer-events-none absolute left-0 right-0 top-1/2 -translate-y-1/2 bg-black opacity-0 group-hover:opacity-100"
                style={{ height: '0.5px' }}
            />

            {/* ── Mobile: stacked ── */}
            <div className="md:hidden flex flex-col gap-1">
                <div className="flex items-center gap-3">
                    <Link
                        href={`/admin/orders/${order.id}`}
                        className="font-reformat whitespace-nowrap font-bold"
                    >
                        o-{order.orderNumber}
                    </Link>
                    <span className="font-reformat whitespace-nowrap opacity-60">
                        {order.status}
                    </span>
                    <span className="flex-1" />
                    <span className="font-reformat tabular-nums whitespace-nowrap opacity-60">
                        <Timestamp createdAt={order.createdAt} />
                    </span>
                </div>
                <div className="font-reformat truncate opacity-60">{order.email}</div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">{cells}</div>
            </div>

            {/* ── Desktop: single grid row ── */}
            <div
                className="hidden md:grid items-center w-full text-[12px] text-black"
                style={ROW_GRID_STYLE}
            >
                <span className="font-reformat tabular-nums whitespace-nowrap">
                    <Timestamp createdAt={order.createdAt} />
                </span>
                <Link href={`/admin/orders/${order.id}`} className="font-reformat font-bold">
                    o-{order.orderNumber}
                </Link>
                <span className="font-reformat whitespace-nowrap opacity-60">{order.status}</span>
                <span className="font-reformat truncate opacity-60 pr-4">{order.email}</span>
                {cells}
            </div>
        </div>
    )
}

/**
 * One email slot for one order.
 *
 * Three distinct states are worth telling apart, and the middle one is the
 * reason this screen exists: sent, never-sent-but-should-have-been, and
 * doesn't-apply. A FAILED send was previously visible only to somebody reading
 * the database.
 */
function Slot({
    order,
    kind,
    row,
}: {
    order: OrderEmailSummary
    kind: OrderEmailKind
    row: EmailRow | null
}) {
    const [pending, startTransition] = useTransition()
    const [error, setError] = useState<string | null>(null)

    const allowed = ALLOWED_BY_STATUS[order.status].includes(kind)
    const expected = EXPECTED_BY_STATUS[order.status].includes(kind)

    function send() {
        setError(null)
        startTransition(async () => {
            const result = await resendOrderEmailAction(order.id, kind)
            if (!result.ok) setError(result.error)
        })
    }

    if (!row && !allowed) {
        return (
            <span className="font-reformat whitespace-nowrap opacity-30">
                {KIND_LABELS[kind]}: —
            </span>
        )
    }

    const failed = row?.status === 'FAILED'
    const label = !row
        ? expected
            ? 'not sent'
            : 'never sent'
        : row.status === 'SENT'
          ? 'sent'
          : row.status === 'FAILED'
            ? 'failed'
            : 'queued'

    // Red for the two states that need someone to act: a send that failed, and
    // one the order's status says should have happened.
    const needsAttention = failed || (!row && expected)

    return (
        <span className="font-reformat whitespace-nowrap inline-flex items-center gap-2">
            <span style={needsAttention ? { color: STOCK_COLORS.NO_STOCK } : undefined}>
                {KIND_LABELS[kind]}: {label}
            </span>
            {row?.status === 'SENT' && (
                <span className="opacity-40 tabular-nums">
                    <Timestamp createdAt={row.createdAt} />
                </span>
            )}
            <button
                type="button"
                onClick={send}
                disabled={pending}
                title={row?.error ?? error ?? undefined}
                className="underline decoration-1 underline-offset-2 opacity-60 hover:opacity-100 disabled:opacity-30"
            >
                {pending ? '…' : row ? 'resend' : 'send'}
            </button>
            {(error || row?.error) && (
                <span
                    className="truncate max-w-[160px] opacity-60"
                    style={{ color: STOCK_COLORS.NO_STOCK }}
                    title={error ?? row?.error ?? undefined}
                >
                    {error ?? row?.error}
                </span>
            )}
        </span>
    )
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
