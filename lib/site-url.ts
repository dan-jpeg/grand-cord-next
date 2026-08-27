/**
 * The app's public origin, for absolute URLs that leave the server — Stripe
 * redirect targets and links inside emails.
 *
 * One helper because there were briefly two variables meaning the same thing:
 * checkout read NEXT_PUBLIC_URL, the email templates read NEXT_PUBLIC_SITE_URL.
 * Setting one and not the other broke the half that read the other, silently
 * and in a way that only showed up in production — checkout fell back to
 * localhost, which Stripe rejects outright in live mode.
 *
 * All three names are accepted so that whichever is already configured keeps
 * working. Prefer NEXT_PUBLIC_SITE_URL for anything new.
 */
export function siteUrl(): string {
    const raw =
        process.env.NEXT_PUBLIC_SITE_URL ||
        process.env.NEXT_PUBLIC_URL ||
        process.env.NEXTAUTH_URL ||
        ''
    return raw.replace(/\/+$/, '')
}

/**
 * The same, but insisting on something usable.
 *
 * Checkout must not fall back to localhost: Stripe's live mode refuses it, so
 * the fallback turned a missing variable into a failed checkout with the stock
 * already reserved. Failing here instead names the actual problem.
 */
export function requireSiteUrl(): string {
    const url = siteUrl()
    if (!url || url.startsWith('http://localhost')) {
        if (process.env.NODE_ENV === 'production') {
            throw new Error(
                'NEXT_PUBLIC_SITE_URL is not set (or points at localhost). Stripe will not ' +
                    'accept a localhost redirect in live mode. Set it to the public origin.',
            )
        }
        return url || 'http://localhost:3000'
    }
    return url
}
