import 'dotenv/config'
import { isEmailConfigured, sendEmail } from '../lib/email/send'
import { orderShippedEmail } from '../lib/email/templates/order-shipped'

/**
 * Send one fixture email to an address you name, to prove the Resend key and
 * the domain's DNS records are actually working.
 *
 *   npx tsx scripts/send-test-email.ts you@grand-cord.com
 *
 * Takes the recipient as a required argument rather than reading it from an
 * order — nothing here should ever be able to reach a customer.
 */

async function main() {
    const to = process.argv[2]
    if (!to || !to.includes('@')) {
        throw new Error('Pass the recipient address: npx tsx scripts/send-test-email.ts you@grand-cord.com')
    }

    if (!isEmailConfigured()) {
        throw new Error('RESEND_API_KEY and EMAIL_FROM must both be set in .env first.')
    }

    // EMAIL_REDIRECT_TO exists to protect customers, and would silently rewrite
    // the address being tested here. Not what anyone wants from a test send.
    if (process.env.EMAIL_REDIRECT_TO) {
        console.warn(
            `Note: EMAIL_REDIRECT_TO is set, so this will go to ` +
                `${process.env.EMAIL_REDIRECT_TO} rather than ${to}.`,
        )
    }

    const message = orderShippedEmail({
        orderNumber: 'TEST-0001',
        total: 410,
        trackingNumber: '9400111899223817200000',
        trackingUrl: 'https://tools.usps.com/go/TrackConfirmAction?tLabels=9400111899223817200000',
        items: [
            { productName: 'Cropped Field Jacket', size: 'M', quantity: 1, price: 285 },
            { productName: 'Rib Watch Cap', size: 'OS', quantity: 2, price: 62.5 },
        ],
        shippingAddress: {
            name: 'Test Recipient',
            address: '4200 W Grand Ave',
            city: 'Chicago',
            state: 'IL',
            zip: '60651',
            country: 'US',
        },
    })

    const { providerMessageId } = await sendEmail({ to, ...message })
    console.log(`Sent from ${process.env.EMAIL_FROM}`)
    console.log(`Resend message id: ${providerMessageId}`)
    console.log(`\nCheck the inbox — and check that it did NOT land in spam.`)
}

main().catch((e) => {
    console.error(e instanceof Error ? e.message : e)
    process.exitCode = 1
})
