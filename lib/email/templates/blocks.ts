import { siteUrl } from '@/lib/email/send'
import { escapeHtml, formatMoney, HAIRLINE, LABEL, MUTED } from '@/lib/email/templates/shell'

/**
 * The content blocks every order email is built from.
 *
 * Kept apart from shell.ts, which owns the chrome and the primitives. These are
 * the sections a customer actually reads, and all of them have to render the
 * same way whether the mail says shipped, confirmed or cancelled — a total that
 * formats differently between two emails about the same order looks like an
 * error even when it isn't.
 */

export type EmailLineItem = {
    productName: string
    size: string
    quantity: number
    price: number
}

type Address = {
    name?: string
    address?: string
    city?: string
    state?: string
    zip?: string
    country?: string
}

/** The shipping address as display lines, skipping anything absent. */
export function addressLines(raw: unknown): string[] {
    const a = (raw ?? {}) as Address
    const cityLine = [a.city, a.state].filter(Boolean).join(', ')
    return [
        a.name,
        a.address,
        [cityLine, a.zip].filter(Boolean).join(' '),
        // Only worth stating when it is not the default.
        a.country && a.country !== 'US' ? a.country : undefined,
    ].filter((line): line is string => !!line && line.trim().length > 0)
}

export function itemsHtml(items: EmailLineItem[]): string {
    const rows = items
        .map(
            (item) => `<tr>
<td style="padding:8px 0;vertical-align:top;">
<div style="font-weight:700;">${escapeHtml(item.productName)}</div>
<div style="${MUTED}">Size: ${escapeHtml(item.size)} &bull; Qty: ${item.quantity}</div>
</td>
<td style="padding:8px 0;text-align:right;vertical-align:top;font-weight:700;white-space:nowrap;">
${formatMoney(item.price * item.quantity)}
</td>
</tr>`,
        )
        .join('\n')

    return `<p style="${LABEL}">Items</p>
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="width:100%;border-collapse:collapse;">
${rows}
</table>`
}

export function itemsText(items: EmailLineItem[]): string[] {
    return [
        'Items',
        ...items.map(
            (i) =>
                `  ${i.productName} — size ${i.size} × ${i.quantity} — ${formatMoney(
                    i.price * i.quantity,
                )}`,
        ),
    ]
}

export function totalHtml(total: number): string {
    return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="width:100%;border-collapse:collapse;">
<tr>
<td style="${LABEL}margin:0;">Total</td>
<td style="text-align:right;font-weight:700;">${formatMoney(total)}</td>
</tr>
</table>`
}

/** Empty string when the order carries no usable address. */
export function addressHtml(raw: unknown, heading = 'Shipping to'): string {
    const lines = addressLines(raw)
    if (lines.length === 0) return ''
    return `<hr style="${HAIRLINE}">
<p style="${LABEL}">${escapeHtml(heading)}</p>
<p style="margin:0;">${lines.map(escapeHtml).join('<br>')}</p>`
}

export function addressText(raw: unknown, heading = 'Shipping to'): string[] {
    const lines = addressLines(raw)
    if (lines.length === 0) return []
    return ['', heading, ...lines.map((l) => `  ${l}`)]
}

/**
 * Where a customer can find the order later.
 *
 * Points at the lookup page, never /order/[orderNumber] — that one is gated on
 * a live Stripe checkout session and 404s for anyone arriving from an inbox
 * hours later. Returns empty when no public origin is configured, rather than
 * emitting a localhost link nobody can open.
 */
export function statusLinkUrl(): string | null {
    return siteUrl() ? `${siteUrl()}/cart/order-status` : null
}

export function statusLinkHtml(): string {
    const url = statusLinkUrl()
    if (!url) return ''
    return `<hr style="${HAIRLINE}">
<p style="${MUTED}">Check this order any time at <a href="${escapeHtml(
        url,
    )}" style="color:#000000;">${escapeHtml(
        url,
    )}</a> using your order number and this email address.</p>`
}

export function statusLinkText(): string[] {
    const url = statusLinkUrl()
    if (!url) return []
    return [
        '',
        `Check this order any time at ${url} using your order number and this email address.`,
    ]
}
