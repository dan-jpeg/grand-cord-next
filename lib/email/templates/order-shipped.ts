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

export type ShippedOrder = {
    orderNumber: string
    total: number
    trackingNumber: string | null
    trackingUrl: string | null
    items: EmailLineItem[]
    shippingAddress: unknown
}

export function orderShippedEmail(order: ShippedOrder): {
    subject: string
    html: string
    text: string
} {
    const subject = `Your Grand-Cord order ${order.orderNumber} has shipped`

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

    const html = emailShell({
        title: subject,
        heading: 'Your order has shipped',
        body: `<p style="margin:0 0 24px;">Order ${escapeHtml(order.orderNumber)} is on its way.</p>
${trackingBlock}
<hr style="${HAIRLINE}">
${itemsHtml(order.items)}
<hr style="${HAIRLINE}">
${totalHtml(order.total)}
${addressHtml(order.shippingAddress)}
${statusLinkHtml()}`,
    })

    const text = [
        'Your order has shipped',
        '',
        `Order ${order.orderNumber} is on its way.`,
        '',
        order.trackingNumber
            ? `Tracking: ${order.trackingNumber}${
                  order.trackingUrl ? `\n${order.trackingUrl}` : ''
              }`
            : 'Tracking details will follow separately.',
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
