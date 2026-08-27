import {
    addressLines,
    statusLinkUrl,
    type EmailLineItem,
} from '@/lib/email/templates/blocks'
import { escapeHtml } from '@/lib/email/templates/shell'

export type ConfirmedOrder = {
    orderNumber: string
    total: number
    items: EmailLineItem[]
    shippingAddress: unknown
}

/**
 * Sent when payment clears, which is the moment the customer stops being able
 * to change anything.
 *
 * Deliberately not a receipt: Stripe already emails one with the card details
 * and the charge, and duplicating that invites the two documents to disagree.
 * This says what was ordered, where it is going, and what happens next.
 *
 * Unlike the shipped and cancelled mails this one does not use `emailShell` —
 * the design drops the masthead, the rules and the Chicago footer, and is a
 * bare sheet with the order laid out on it like a packing slip.
 */

const SHEET =
    "font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;" +
    'font-size:14px;line-height:1.45;color:#000000;'

/** `750 $`, trailing sign, and no cents on a whole number — as drawn. */
function money(amount: number): string {
    const n = Number.isInteger(amount) ? amount.toFixed(0) : amount.toFixed(2)
    return `${n} $`
}

/**
 * The design labels the order `O-0001`. Order numbers are stored bare (`0042`),
 * so the prefix is presentation, applied only when the stored value is digits —
 * anything already carrying its own prefix is left alone.
 */
function orderLabel(orderNumber: string): string {
    return /^\d+$/.test(orderNumber) ? `O-${orderNumber}` : orderNumber
}

/** The same four columns as the HTML table, for the plain-text part. */
function itemLines(items: EmailLineItem[]): string[] {
    return items.map(
        (i) => `${i.productName}  ${i.size}  x ${i.quantity}  ${money(i.price * i.quantity)}`,
    )
}

function itemRows(items: EmailLineItem[]): string {
    return items
        .map(
            (item) => `<tr>
<td style="padding:6px 0;width:40%;">${escapeHtml(item.productName)}</td>
<td style="padding:6px 0;width:22%;">${escapeHtml(item.size)}</td>
<td style="padding:6px 0;width:14%;">x ${item.quantity}</td>
<td style="padding:6px 0;width:24%;text-align:right;white-space:nowrap;">${money(
                item.price * item.quantity,
            )}</td>
</tr>`,
        )
        .join('\n')
}

export function orderConfirmedEmail(order: ConfirmedOrder): {
    subject: string
    html: string
    text: string
} {
    const label = orderLabel(order.orderNumber)
    const subject = `Order ${label} confirmed`

    const address = addressLines(order.shippingAddress)
    const statusUrl = statusLinkUrl()
    // Shown without the scheme, the way the design writes it. Only the address
    // itself is the anchor — the sentence around it stays plain text, so the
    // underline lands on the part a customer would click.
    const statusHost = statusUrl ? statusUrl.replace(/^https?:\/\//, '') : ''
    const statusLead = 'To view order status, please consult '
    const statusText = statusUrl ? `${statusLead}${statusHost}` : ''

    const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light only">
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#ffffff;">
<div style="max-width:560px;margin:0 auto;padding:40px 24px;${SHEET}">

<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="width:100%;border-collapse:collapse;">
<tr>
<td style="vertical-align:top;font-weight:700;">Thank you for your order.<br>We will notify you when it ships.</td>
<td style="vertical-align:top;text-align:right;font-weight:700;white-space:nowrap;">${escapeHtml(
        label,
    )}</td>
</tr>
</table>

<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="width:100%;border-collapse:collapse;margin:120px 0 0;">
${itemRows(order.items)}
</table>

<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="width:100%;border-collapse:collapse;margin:40px 0 0;">
<tr>
<td style="width:62%;"></td>
<td style="width:14%;font-weight:700;">Total</td>
<td style="width:24%;text-align:right;font-weight:700;white-space:nowrap;">${money(order.total)}</td>
</tr>
</table>

<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="width:100%;border-collapse:collapse;margin:160px 0 0;">
<tr>
<td style="width:36%;vertical-align:top;">Ship to</td>
<td style="width:64%;vertical-align:top;">${
        statusUrl
            ? `${statusLead}<a href="${escapeHtml(
                  statusUrl,
              )}" style="color:#000000;text-decoration:underline;">${escapeHtml(statusHost)}</a>`
            : ''
    }</td>
</tr>
</table>
${
    address.length > 0
        ? `<p style="margin:20px 0 0;font-weight:700;">${address.map(escapeHtml).join('<br>')}</p>`
        : ''
}

</div>
</body>
</html>`

    const text = [
        'Thank you for your order.',
        'We will notify you when it ships.',
        '',
        label,
        '',
        ...itemLines(order.items),
        '',
        `Total: ${money(order.total)}`,
        ...(address.length > 0 ? ['', 'Ship to', ...address.map((l) => `  ${l}`)] : []),
        ...(statusText ? ['', statusText] : []),
    ].join('\n')

    return { subject, html, text }
}
