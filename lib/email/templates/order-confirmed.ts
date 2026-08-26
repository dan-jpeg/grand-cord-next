import {
    addressHtml,
    addressText,
    itemsHtml,
    itemsText,
    statusLinkHtml,
    statusLinkText,
    totalHtml,
    type EmailLineItem,
} from '@/lib/email/templates/blocks'
import { emailShell, escapeHtml, formatMoney, HAIRLINE, LABEL } from '@/lib/email/templates/shell'

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
 */
export function orderConfirmedEmail(order: ConfirmedOrder): {
    subject: string
    html: string
    text: string
} {
    const subject = `Grand-Cord order ${order.orderNumber} confirmed`

    const html = emailShell({
        title: subject,
        heading: 'Thank you for your order',
        body: `<p style="margin:0 0 24px;">We have your order and payment. You will hear from us again when it ships.</p>
<p style="${LABEL}">Order number</p>
<p style="margin:0 0 24px;font-weight:700;">${escapeHtml(order.orderNumber)}</p>
<hr style="${HAIRLINE}">
${itemsHtml(order.items)}
<hr style="${HAIRLINE}">
${totalHtml(order.total)}
${addressHtml(order.shippingAddress)}
${statusLinkHtml()}`,
    })

    const text = [
        'Thank you for your order',
        '',
        'We have your order and payment. You will hear from us again when it ships.',
        '',
        `Order number: ${order.orderNumber}`,
        '',
        ...itemsText(order.items),
        '',
        `Total: ${formatMoney(order.total)}`,
        ...addressText(order.shippingAddress),
        ...statusLinkText(),
        '',
        'All orders are shipped from Chicago.',
    ].join('\n')

    return { subject, html, text }
}
