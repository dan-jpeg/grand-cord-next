'use client'

import { useEffect, useState } from 'react'
import { getOrderPaymentInfo, type PaymentInfo } from '@/app/admin/orders/actions'

const money = (cents: number, currency: string) =>
    new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency.toUpperCase(),
    }).format(cents / 100)

function Row({ label, value }: { label: string; value: React.ReactNode }) {
    if (value === null || value === undefined || value === '') return null
    return (
        <div className="flex items-start justify-between gap-[16px] py-[7px] border-b border-neutral-200">
            <span className="opacity-50 whitespace-nowrap">{label}</span>
            <span className="text-right break-all">{value}</span>
        </div>
    )
}

/**
 * Full-screen Payment Info overlay. The close control sits at the top left, per
 * the admin order detail layout. Stripe is queried when the sheet opens, so a
 * closed modal costs nothing.
 */
export function PaymentInfoModal({
    orderId,
    onClose,
}: {
    orderId: string
    onClose: () => void
}) {
    const [payment, setPayment] = useState<PaymentInfo | null>(null)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        let active = true
        getOrderPaymentInfo(orderId).then((res) => {
            if (!active) return
            if (res.ok) setPayment(res.payment)
            else setError(res.error)
        })
        return () => {
            active = false
        }
    }, [orderId])

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose()
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [onClose])

    const card = payment?.card
    const billing = payment?.billing

    return (
        <div className="fixed inset-0 z-[200] bg-white text-[12px] font-bold text-black overflow-auto">
            <button
                type="button"
                onClick={onClose}
                aria-label="Close payment info"
                className="absolute top-[14px] left-[11px] p-[4px] -m-[4px]"
            >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
                    <path
                        d="M1 1L13 13M13 1L1 13"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                    />
                </svg>
            </button>

            <div className="px-[11px] pt-[14px] pb-[40px] max-w-[640px] mx-auto">
                <div className="text-center">Payment Info</div>

                <div className="pt-[48px]">
                    {!payment && !error && <div className="opacity-50">Loading from Stripe…</div>}

                    {error && (
                        <div className="space-y-[8px]">
                            <div className="text-red-700">Could not load payment.</div>
                            <div className="font-normal opacity-70 break-all">{error}</div>
                        </div>
                    )}

                    {payment && (
                        <>
                            <Row
                                label="status"
                                value={
                                    payment.refunded
                                        ? `refunded (${money(payment.amountRefunded, payment.currency)})`
                                        : payment.status
                                }
                            />
                            <Row label="amount" value={money(payment.amount, payment.currency)} />
                            {payment.amountReceived !== payment.amount && (
                                <Row
                                    label="received"
                                    value={money(payment.amountReceived, payment.currency)}
                                />
                            )}
                            {payment.fee !== null && (
                                <Row label="stripe fee" value={money(payment.fee, payment.currency)} />
                            )}
                            {payment.net !== null && (
                                <Row label="net" value={money(payment.net, payment.currency)} />
                            )}
                            <Row
                                label="paid"
                                value={
                                    payment.created
                                        ? new Date(payment.created).toLocaleString('en-US')
                                        : null
                                }
                            />

                            {card && (
                                <>
                                    <Row
                                        label="card"
                                        value={[card.brand, card.last4 && `•••• ${card.last4}`]
                                            .filter(Boolean)
                                            .join(' ')}
                                    />
                                    <Row
                                        label="expires"
                                        value={
                                            card.expMonth && card.expYear
                                                ? `${String(card.expMonth).padStart(2, '0')}/${card.expYear}`
                                                : null
                                        }
                                    />
                                    <Row label="funding" value={card.funding} />
                                    <Row label="wallet" value={card.wallet} />
                                    <Row label="issuer country" value={card.country} />
                                </>
                            )}

                            {billing && (
                                <>
                                    <Row label="billing name" value={billing.name} />
                                    <Row label="billing email" value={billing.email} />
                                    <Row label="billing phone" value={billing.phone} />
                                    <Row
                                        label="billing address"
                                        value={
                                            [
                                                billing.line1,
                                                billing.line2,
                                                [billing.city, billing.state, billing.postalCode]
                                                    .filter(Boolean)
                                                    .join(' '),
                                                billing.country,
                                            ]
                                                .filter(Boolean)
                                                .join(', ') || null
                                        }
                                    />
                                </>
                            )}

                            <Row
                                label="payment intent"
                                value={<span className="font-mono">{payment.paymentIntentId}</span>}
                            />
                            <Row
                                label="charge"
                                value={
                                    payment.chargeId ? (
                                        <span className="font-mono">{payment.chargeId}</span>
                                    ) : null
                                }
                            />

                            {payment.receiptUrl && (
                                <a
                                    href={payment.receiptUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-block mt-[20px] underline"
                                >
                                    View Stripe receipt
                                </a>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}

/** Button + modal pair, for callers that just want the affordance. */
export function PaymentInfoButton({
    orderId,
    className,
}: {
    orderId: string
    className?: string
}) {
    const [open, setOpen] = useState(false)

    return (
        <>
            <button type="button" onClick={() => setOpen(true)} className={className}>
                Payment Info
            </button>
            {open && <PaymentInfoModal orderId={orderId} onClose={() => setOpen(false)} />}
        </>
    )
}
