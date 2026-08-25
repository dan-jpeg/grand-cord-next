'use server'

import { headers } from 'next/headers'
import { clientIpFrom, describeThrottle, type ThrottleState } from '@/lib/login-throttle'

/**
 * Why the last sign-in failed, for the login screen to say so.
 *
 * NextAuth deliberately does not carry `authorize()`'s error message back to
 * the browser, so the form cannot tell a wrong password from a lockout on its
 * own. Rather than depending on the beta's error-code channel, it asks here.
 */
export async function checkLoginThrottle(identifier: string): Promise<ThrottleState> {
    if (!identifier?.trim()) return { throttled: false, retryAfterMinutes: 0 }

    const ip = clientIpFrom({ headers: await headers() })
    return describeThrottle(identifier, ip)
}
