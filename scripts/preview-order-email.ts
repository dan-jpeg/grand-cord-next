import 'dotenv/config'
import { writeFileSync } from 'fs'
import { orderCancelledEmail } from '../lib/email/templates/order-cancelled'
import { orderConfirmedEmail } from '../lib/email/templates/order-confirmed'
import { orderShippedEmail, type ShippedOrder } from '../lib/email/templates/order-shipped'
import { prisma } from '../lib/prisma'

/**
 * Render a customer email to an HTML file without sending anything.
 *
 * With no order number it uses fixture data, so the templates can be worked on
 * without a database. Pass one to render that order exactly as the customer
 * would receive it.
 *
 *   npx tsx scripts/preview-order-email.ts shipped
 *   npx tsx scripts/preview-order-email.ts confirmed 0042 out.html
 */

const FIXTURE: ShippedOrder = {
    orderNumber: '0042',
    total: 410,
    trackingNumber: '9400111899223817200000',
    trackingUrl: 'https://tools.usps.com/go/TrackConfirmAction?tLabels=9400111899223817200000',
    items: [
        { productName: 'Cropped Field Jacket', size: 'M', quantity: 1, price: 285 },
        { productName: 'Rib Watch Cap', size: 'OS', quantity: 2, price: 62.5 },
    ],
    shippingAddress: {
        name: 'Ada Lovelace',
        address: '4200 W Grand Ave',
        city: 'Chicago',
        state: 'IL',
        zip: '60651',
        country: 'US',
    },
}

// 'cancelled' renders the refunded copy; 'cancelled-norefund' the variant an
// admin cancelling without a refund produces.
const KINDS = ['shipped', 'confirmed', 'cancelled', 'cancelled-norefund'] as const
type Kind = (typeof KINDS)[number]

async function main() {
    const kind = (process.argv[2] || 'shipped') as Kind
    if (!KINDS.includes(kind)) {
        throw new Error(`Unknown email "${kind}". Choose one of: ${KINDS.join(', ')}`)
    }
    const orderNumber = process.argv[3]
    const outPath = process.argv[4] ?? `order-${kind}.html`

    let data: ShippedOrder = FIXTURE
    if (orderNumber) {
        const order = await prisma.order.findUnique({
            where: { orderNumber },
            include: { items: true },
        })
        if (!order) throw new Error(`No order ${orderNumber}`)
        data = {
            orderNumber: order.orderNumber,
            total: order.total,
            trackingNumber: order.trackingNumber,
            trackingUrl: order.trackingUrl,
            items: order.items,
            shippingAddress: order.shippingAddress,
        }
    }

    const { subject, html, text } =
        kind === 'confirmed'
            ? orderConfirmedEmail(data)
            : kind === 'cancelled' || kind === 'cancelled-norefund'
              ? orderCancelledEmail({
                    ...data,
                    refundedCents: kind === 'cancelled' ? Math.round(data.total * 100) : 0,
                    supportEmail: process.env.EMAIL_REPLY_TO || null,
                })
              : orderShippedEmail(data)
    writeFileSync(outPath, html)

    console.log(`Subject: ${subject}`)
    console.log(`HTML:    ${outPath}`)
    console.log(`\n--- text part ---\n${text}`)
}

main()
    .catch((e) => {
        console.error(e instanceof Error ? e.message : e)
        process.exitCode = 1
    })
    .finally(() => prisma.$disconnect())
