'use client'

import { useEffect, useState } from 'react'
import { cancelOrderAction, getOrderRefundableCents } from '@/app/admin/orders/actions'
import type { RefundChoice } from '@/lib/orders/cancel-order'

const money = (cents: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)

/**
 * Full-screen sheet that asks what cancelling should do to the customer's money.
 * There is no pre-selected answer — refunding and not refunding are both
 * one-way, so the admin has to say which one they mean.
 */
export function CancelOrderPrompt({
    orderId,
    orderNumber,
    onDone,
    onCancel,
}: {
    orderId: string
    orderNumber: string
    onDone: () => void
    onCancel: () => void
}) {
    const [choice, setChoice] = useState<RefundChoice | null>(null)
    const [refundable, setRefundable] = useState<number | null>(null)
    const [lookupError, setLookupError] = useState<string | null>(null)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)
    // The cancel went through, but something about it needs saying — a refund
    // that was already issued, or stock that could not be returned. Distinct
    // from `error`, which means nothing happened.
    const [notes, setNotes] = useState<string[] | null>(null)

    useEffect(() => {
        let active = true
        getOrderRefundableCents(orderId).then((res) => {
            if (!active) return
            if (res.ok) setRefundable(res.cents)
            else setLookupError(res.error)
        })
        return () => {
            active = false
        }
    }, [orderId])

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !saving) onCancel()
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [onCancel, saving])

    async function handleConfirm() {
        if (!choice || saving) return
        setSaving(true)
        setError(null)

        const res = await cancelOrderAction(orderId, choice)

        if (!res.ok) {
            setSaving(false)
            setError(res.error)
            return
        }

        // The order is cancelled either way. Anything that could not be finished
        // is reported as a note, not an error — saying "failed" here would
        // invite a retry of something that already succeeded.
        const { refundSkippedReason, unrestoredItems, cancelled } = res.result
        const collected = [
            !cancelled ? 'This order was already cancelled; nothing changed.' : null,
            refundSkippedReason ?? null,
            ...unrestoredItems,
        ].filter((n): n is string => n !== null)

        if (collected.length > 0) {
            setSaving(false)
            setNotes(collected)
            return
        }

        onDone()
    }

    const nothingToRefund = refundable !== null && refundable <= 0

    return (
        <div className="fixed inset-0 z-[200] bg-white text-[12px] font-bold text-black overflow-auto">
            <button
                type="button"
                onClick={onCancel}
                disabled={saving}
                aria-label="Close"
                className="absolute top-[14px] left-[11px] p-[4px] -m-[4px] disabled:opacity-40"
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
                <div className="text-center">Cancel {orderNumber}</div>

                <div className="pt-[48px] flex flex-col gap-[20px]">
                    <p className="font-normal opacity-70 leading-[1.5]">
                        {refundable === null && !lookupError && 'Checking Stripe…'}
                        {lookupError && `Stripe: ${lookupError}`}
                        {refundable !== null &&
                            (nothingToRefund
                                ? 'Nothing is left to refund on this payment.'
                                : `${money(refundable)} can still be refunded to the customer.`)}
                    </p>

                    <div className="flex flex-col gap-[8px]">
                        <ChoiceRow
                            label="Refund in full"
                            detail={
                                refundable !== null && !nothingToRefund
                                    ? `Return ${money(refundable)} to the customer now.`
                                    : 'Return the full remaining balance to the customer.'
                            }
                            selected={choice === 'FULL_REFUND'}
                            disabled={saving || nothingToRefund}
                            onSelect={() => setChoice('FULL_REFUND')}
                        />
                        <ChoiceRow
                            label="Cancel without refunding"
                            detail="Mark the order cancelled and leave the payment as it is."
                            selected={choice === 'NO_REFUND'}
                            disabled={saving}
                            onSelect={() => setChoice('NO_REFUND')}
                        />
                    </div>

                    {/* Stock is only returned for orders that never shipped. */}
                    <p className="font-normal opacity-50 leading-[1.5]">
                        Cancelling returns the items to available stock unless the order has
                        already shipped.
                    </p>

                    {error && <div className="text-red-700 font-normal leading-[1.5]">{error}</div>}

                    {notes && (
                        <div className="border border-black px-[12px] py-[11px] flex flex-col gap-[6px]">
                            <span>Order cancelled.</span>
                            {notes.map((n) => (
                                <span key={n} className="font-normal opacity-70 leading-[1.5]">
                                    {n}
                                </span>
                            ))}
                        </div>
                    )}

                    {notes ? (
                        <button
                            type="button"
                            onClick={onDone}
                            className="w-full bg-black text-white py-[12px]"
                        >
                            Done
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={handleConfirm}
                            disabled={saving || !choice}
                            className="w-full bg-black text-white py-[12px] disabled:opacity-30"
                        >
                            {saving
                                ? 'Cancelling…'
                                : choice === 'FULL_REFUND'
                                  ? 'Cancel Order and Refund'
                                  : 'Cancel Order'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}

function ChoiceRow({
    label,
    detail,
    selected,
    disabled,
    onSelect,
}: {
    label: string
    detail: string
    selected: boolean
    disabled: boolean
    onSelect: () => void
}) {
    return (
        <button
            type="button"
            onClick={onSelect}
            disabled={disabled}
            aria-pressed={selected}
            className={`w-full text-left px-[12px] py-[11px] border transition-colors disabled:opacity-30 ${
                selected ? 'border-black bg-[#e8e6e6]' : 'border-neutral-300'
            }`}
        >
            <span className="block">{label}</span>
            <span className="block font-normal opacity-60 mt-[2px]">{detail}</span>
        </button>
    )
}
