'use client'

import { useEffect, useState } from 'react'
import { updateOrderStatus } from '@/app/admin/orders/actions'

/**
 * Full-screen sheet that collects the tracking number and URL before an order is
 * marked SHIPPED. Close control sits at the top left, matching the Payment Info
 * sheet.
 */
export function TrackingPrompt({
    orderId,
    orderNumber,
    trackingNumber: initialNumber,
    trackingUrl: initialUrl,
    alreadyShipped = false,
    onDone,
    onCancel,
}: {
    orderId: string
    orderNumber: string
    trackingNumber: string | null
    trackingUrl: string | null
    alreadyShipped?: boolean
    onDone: () => void
    onCancel: () => void
}) {
    const [number, setNumber] = useState(initialNumber ?? '')
    const [url, setUrl] = useState(initialUrl ?? '')
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !saving) onCancel()
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [onCancel, saving])

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (saving) return
        setSaving(true)
        setError(null)
        try {
            await updateOrderStatus(
                orderId,
                'SHIPPED',
                number.trim() || undefined,
                url.trim() || undefined,
            )
            onDone()
        } catch (err) {
            // updateOrderStatus redirects on success, which surfaces here as a
            // Next.js control-flow error — let it through.
            if (
                err &&
                typeof err === 'object' &&
                'digest' in err &&
                String((err as { digest?: unknown }).digest).startsWith('NEXT_REDIRECT')
            ) {
                throw err
            }
            setSaving(false)
            setError(err instanceof Error ? err.message : 'Could not update the order.')
        }
    }

    return (
        <div className="fixed inset-0 z-[200] bg-white text-[12px] font-bold text-black overflow-auto">
            <button
                type="button"
                onClick={onCancel}
                disabled={saving}
                aria-label="Cancel"
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

            <form
                onSubmit={handleSubmit}
                className="px-[11px] pt-[14px] pb-[40px] max-w-[640px] mx-auto"
            >
                <div className="text-center">
                    {alreadyShipped ? `Tracking — ${orderNumber}` : `Mark ${orderNumber} Shipped`}
                </div>

                <div className="pt-[48px] space-y-[24px]">
                    <label className="block">
                        <span className="block opacity-50 mb-[6px]">tracking number</span>
                        <input
                            type="text"
                            value={number}
                            onChange={(e) => setNumber(e.target.value)}
                            placeholder="1Z999AA10123456784"
                            autoFocus
                            className="w-full border-b border-black pb-[6px] font-bold focus:outline-none placeholder:opacity-30"
                        />
                    </label>

                    <label className="block">
                        <span className="block opacity-50 mb-[6px]">tracking url</span>
                        <input
                            type="url"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            placeholder="https://www.ups.com/track?..."
                            className="w-full border-b border-black pb-[6px] font-bold focus:outline-none placeholder:opacity-30"
                        />
                    </label>

                    {error && <div className="text-red-700 font-normal">{error}</div>}

                    <button
                        type="submit"
                        disabled={saving}
                        className="w-full bg-black text-white py-[12px] disabled:opacity-50"
                    >
                        {saving ? 'Saving…' : alreadyShipped ? 'Save Tracking' : 'Mark as Shipped'}
                    </button>
                </div>
            </form>
        </div>
    )
}
