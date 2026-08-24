'use client'

import { useEffect, useRef, useState } from 'react'
import { useCart } from '@/contexts/cart-context'
import { priceCart } from '@/app/(store)/checkout/actions'
import { formatPrice } from '@/lib/utils'

type Change = {
    productName: string
    size: string
    was: number
    now: number
}

/**
 * Reconciles the cart against the catalogue and says what moved.
 *
 * A cart persists in localStorage, so one filled last week can carry a price
 * the catalogue no longer charges. Checkout prices from the database either
 * way — the customer just used to find that out on their card statement. This
 * runs once when the cart is shown, corrects the stored prices so the subtotal
 * on screen is the amount that will actually be taken, and names the lines that
 * changed so the correction is not silent.
 *
 * Deliberately quiet when nothing moved, which is almost always.
 */
export function CartPriceNotice() {
    const { items, syncPrices } = useCart()
    const [changes, setChanges] = useState<Change[]>([])
    const checked = useRef(false)

    useEffect(() => {
        // Once per visit to the cart. Without this, syncPrices updating `items`
        // would re-trigger the check that caused it.
        if (checked.current || items.length === 0) return
        checked.current = true

        const lines = items.map(item => ({
            productId: item.productId,
            size: item.size,
            quantity: item.quantity,
        }))
        const priceWhenChecked = new Map(
            items.map(item => [`${item.productId}-${item.size}`, item.price])
        )

        priceCart(lines)
            .then(result => {
                setChanges(
                    result.lines.flatMap(line => {
                        const was = priceWhenChecked.get(`${line.productId}-${line.size}`)
                        if (was === undefined || was === line.price) return []
                        return [{
                            productName: line.productName,
                            size: line.size,
                            was,
                            now: line.price,
                        }]
                    })
                )
                syncPrices(result.lines)
            })
            // A failed check is not worth interrupting the cart over — checkout
            // prices from the catalogue regardless, so the amount taken is
            // right whether or not this notice ever renders.
            .catch(() => {})
    }, [items, syncPrices])

    if (changes.length === 0) return null

    return (
        <div
            role="status"
            className="border border-black px-4 py-3 text-[8.5pt] font-medium leading-relaxed"
        >
            <div className="font-bold uppercase tracking-wide">
                {changes.length === 1 ? 'A price has changed' : 'Some prices have changed'}
            </div>
            <ul className="mt-2 flex flex-col gap-1">
                {changes.map(change => (
                    <li key={`${change.productName}-${change.size}`} className="flex flex-wrap gap-1">
                        <span>{change.productName} ({change.size})</span>
                        <span className="tabular-nums">
                            <span className="line-through opacity-50">{formatPrice(change.was)}</span>
                            {' → '}
                            <span className="font-bold">{formatPrice(change.now)}</span>
                        </span>
                    </li>
                ))}
            </ul>
            <div className="mt-2 opacity-70">
                Your subtotal has been updated. This is the amount you will be charged.
            </div>
        </div>
    )
}
