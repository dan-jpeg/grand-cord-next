import { siteUrl } from '@/lib/email/send'
import {
    emailShell,
    escapeHtml,
    formatMoney,
    HAIRLINE,
    LABEL,
    MUTED,
} from '@/lib/email/templates/shell'

export type ShippedOrder = {
    orderNumber: string
    total: number
    trackingNumber: string | null
    trackingUrl: string | null
    items: Array<{
        productName: string
        size: string
        quantity: number
        price: number
    }>
    shippingAddress: unknown
}

type Address = {
    name?: string
    address?: string
    city?: string
    state?: string
    zip?: string
    country?: string
}

function addressLines(raw: unknown): string[] {
    const a = (raw ?? {}) as Address
    const cityLine = [a.city, a.state].filter(Boolean).join(', ')
    return [
        a.name,
        a.address,
        [cityLine, a.zip].filter(Boolean).join(' '),
        a.country && a.country !== 'US' ? a.country : undefined,
    ].filter((line): line is string => !!line && line.trim().length > 0)
}

export function orderShippedEmail(order: ShippedOrder): {
    subject: string
    html: string
    text: string
} {
    const subject = `Your Grand-Cord order ${order.orderNumber} has shipped`

    // The confirmation page at /order/[orderNumber] is gated on a live Stripe
    // checkout session, so it 404s for anyone arriving from an inbox. The
    // lookup page asks for the order number and email instead, which is what a
    // customer clicking days later actually has.
    const statusUrl = siteUrl() ? `${siteUrl()}/cart/order-status` : null

    const itemRows = order.items
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

    const trackingBlock = order.trackingNumber
        ? `<p style="${LABEL}">Tracking</p>
<p style="margin:0 0 24px;font-weight:700;">${
              order.trackingUrl
                  ? `<a href="${escapeHtml(order.trackingUrl)}" style="color:#000000;">${escapeHtml(
                        order.trackingNumber,
                    )}</a>`
                  : escapeHtml(order.trackingNumber)
          }</p>`
        : `<p style="margin:0 0 24px;">Tracking details will follow separately.</p>`

    const addressBlock = addressLines(order.shippingAddress)
        .map((line) => escapeHtml(line))
        .join('<br>')

    const html = emailShell({
        title: subject,
        heading: 'Your order has shipped',
        body: `<p style="margin:0 0 24px;">Order ${escapeHtml(order.orderNumber)} is on its way.</p>
${trackingBlock}
<hr style="${HAIRLINE}">
<p style="${LABEL}">Items</p>
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="width:100%;border-collapse:collapse;">
${itemRows}
</table>
<hr style="${HAIRLINE}">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="width:100%;border-collapse:collapse;">
<tr>
<td style="${LABEL}margin:0;">Total</td>
<td style="text-align:right;font-weight:700;">${formatMoney(order.total)}</td>
</tr>
</table>
${
    addressBlock
        ? `<hr style="${HAIRLINE}">
<p style="${LABEL}">Shipping to</p>
<p style="margin:0;">${addressBlock}</p>`
        : ''
}
${
    statusUrl
        ? `<hr style="${HAIRLINE}">
<p style="${MUTED}">Check this order any time at <a href="${escapeHtml(
              statusUrl,
          )}" style="color:#000000;">${escapeHtml(statusUrl)}</a> using your order number and this email address.</p>`
        : ''
}`,
    })

    const text = [
        `Your order has shipped`,
        ``,
        `Order ${order.orderNumber} is on its way.`,
        ``,
        order.trackingNumber
            ? `Tracking: ${order.trackingNumber}${
                  order.trackingUrl ? `\n${order.trackingUrl}` : ''
              }`
            : `Tracking details will follow separately.`,
        ``,
        `Items`,
        ...order.items.map(
            (i) =>
                `  ${i.productName} — size ${i.size} × ${i.quantity} — ${formatMoney(
                    i.price * i.quantity,
                )}`,
        ),
        ``,
        `Total: ${formatMoney(order.total)}`,
        ...(addressLines(order.shippingAddress).length
            ? ['', 'Shipping to', ...addressLines(order.shippingAddress).map((l) => `  ${l}`)]
            : []),
        ...(statusUrl
            ? [
                  '',
                  `Check this order any time at ${statusUrl} using your order number and this email address.`,
              ]
            : []),
        ``,
        `All orders are shipped from Chicago.`,
    ].join('\n')

    return { subject, html, text }
}
