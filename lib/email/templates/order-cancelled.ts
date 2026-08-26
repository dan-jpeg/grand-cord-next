import {
    itemsHtml,
    itemsText,
    statusLinkHtml,
    statusLinkText,
    totalHtml,
    type EmailLineItem,
} from '@/lib/email/templates/blocks'
import { emailShell, escapeHtml, formatMoney, HAIRLINE, LABEL, MUTED } from '@/lib/email/templates/shell'

export type CancelledOrder = {
    orderNumber: string
    total: number
    items: EmailLineItem[]
    /** What was actually returned to the customer on this cancellation, in cents. */
    refundedCents: number
    /** Reply address, when one is configured. Omitted rather than invented. */
    supportEmail: string | null
}

/**
 * Sent when a paid order is cancelled.
 *
 * The one rule this template exists to enforce: a refund is only ever mentioned
 * when money genuinely moved. `refundedCents` is what Stripe actually returned,
 * not what was intended — an admin can cancel without refunding, and a refund
 * can be skipped because the payment was already returned. Telling someone
 * their money is coming back when it isn't is the worst thing this email could
 * do, so the copy is driven by the amount rather than by the admin's choice.
 */
export function orderCancelledEmail(order: CancelledOrder): {
    subject: string
    html: string
    text: string
} {
    const subject = `Grand-Cord order ${order.orderNumber} has been cancelled`
    const refunded = order.refundedCents > 0

    const refundHtml = refunded
        ? `<p style="${LABEL}">Refunded</p>
<p style="margin:0 0 8px;font-weight:700;">${formatMoney(order.refundedCents / 100)}</p>
<p style="${MUTED}">Returned to your original payment method. Banks usually take 5–10 business days to post it.</p>`
        : ''

    // Only offered when there is somewhere for a reply to land.
    const contactHtml = order.supportEmail
        ? `<p style="${MUTED}">Questions about this cancellation? Write to <a href="mailto:${escapeHtml(
              order.supportEmail,
          )}" style="color:#000000;">${escapeHtml(order.supportEmail)}</a>.</p>`
        : ''

    const html = emailShell({
        title: subject,
        heading: 'Your order has been cancelled',
        body: `<p style="margin:0 0 24px;">Order ${escapeHtml(
            order.orderNumber,
        )} has been cancelled and will not be shipped.</p>
${refunded ? `${refundHtml}<hr style="${HAIRLINE}">` : ''}
${itemsHtml(order.items)}
<hr style="${HAIRLINE}">
${totalHtml(order.total)}
${contactHtml ? `<hr style="${HAIRLINE}">${contactHtml}` : ''}
${statusLinkHtml()}`,
    })

    const text = [
        'Your order has been cancelled',
        '',
        `Order ${order.orderNumber} has been cancelled and will not be shipped.`,
        ...(refunded
            ? [
                  '',
                  `Refunded: ${formatMoney(order.refundedCents / 100)}`,
                  'Returned to your original payment method. Banks usually take 5–10 business days to post it.',
              ]
            : []),
        '',
        ...itemsText(order.items),
        '',
        `Order total: ${formatMoney(order.total)}`,
        ...(order.supportEmail
            ? ['', `Questions about this cancellation? Write to ${order.supportEmail}.`]
            : []),
        ...statusLinkText(),
        '',
        'All orders are shipped from Chicago.',
    ].join('\n')

    return { subject, html, text }
}
