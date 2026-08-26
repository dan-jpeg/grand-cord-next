const RESEND_API = 'https://api.resend.com'

export type EmailMessage = {
    to: string
    subject: string
    html: string
    /** Always supplied. A transactional email with no text part scores as spam. */
    text: string
}

/**
 * Whether we are in a position to send at all.
 *
 * Checked by callers *before* they claim a slot in OrderEmail, so that a local
 * checkout run without mail credentials leaves no misleading FAILED rows behind
 * and the same order still mails correctly once the keys are set in production.
 */
export function isEmailConfigured(): boolean {
    return !!process.env.RESEND_API_KEY && !!process.env.EMAIL_FROM
}

/**
 * The public origin, for links inside emails. Unlike a page, an email cannot
 * use a relative URL, and it is read days later on a device that has never
 * touched the site.
 */
export function siteUrl(): string {
    const raw = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXTAUTH_URL ?? ''
    return raw.replace(/\/+$/, '')
}

type ResendResponse = { id: string }

/**
 * Sends one message and returns the provider's id for it.
 *
 * Throws on any failure. Callers decide what a failure means — for order mail
 * it is recorded on the OrderEmail row and swallowed, because no email is worth
 * failing a shipment or a webhook over.
 */
export async function sendEmail(msg: EmailMessage): Promise<{ providerMessageId: string }> {
    const apiKey = process.env.RESEND_API_KEY
    const from = process.env.EMAIL_FROM
    if (!apiKey || !from) throw new Error('RESEND_API_KEY or EMAIL_FROM is not set')

    // Staging and local runs work against real order data, including real
    // customer addresses. This is the guard that stops a test shipment from
    // mailing an actual person.
    const redirect = process.env.EMAIL_REDIRECT_TO
    const to = redirect || msg.to
    const subject = redirect ? `[to: ${msg.to}] ${msg.subject}` : msg.subject

    const res = await fetch(`${RESEND_API}/emails`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            from,
            to: [to],
            subject,
            html: msg.html,
            text: msg.text,
            ...(process.env.EMAIL_REPLY_TO ? { reply_to: process.env.EMAIL_REPLY_TO } : {}),
        }),
    })

    if (!res.ok) {
        const body = await res.text()
        throw new Error(`Resend rejected the message: ${res.status} ${body}`)
    }

    const data = (await res.json()) as ResendResponse
    return { providerMessageId: data.id }
}
