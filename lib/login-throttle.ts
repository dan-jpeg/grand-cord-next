import { prisma } from './prisma'

/**
 * Throttling for the admin credentials login.
 *
 * The provider had no rate limiting at all, so the login was open to unlimited
 * password guessing. Counting lives in the database rather than in module scope
 * because an in-process counter resets on every cold start and is not shared
 * between instances — on serverless that is not a control, it is a decoration.
 *
 * Two independent limits. The per-identifier one stops a single account being
 * ground down; the per-IP one stops someone spreading attempts across many
 * addresses to stay under it.
 */

/** How far back failures are counted. */
const WINDOW_MINUTES = 15

/** Failures against one login before it locks. */
const MAX_PER_IDENTIFIER = 8

/** Failures from one address before it locks, across all logins. */
const MAX_PER_IP = 30

/** Rows older than this are deleted opportunistically. */
const RETAIN_MINUTES = 60

function windowStart(minutes: number) {
    return new Date(Date.now() - minutes * 60 * 1000)
}

export function normalizeIdentifier(identifier: string) {
    return identifier.trim().toLowerCase()
}

/**
 * Pulls the client address out of the sign-in request.
 *
 * The leftmost `x-forwarded-for` entry is the one value in this header a client
 * can choose for itself: send `X-Forwarded-For: 1.2.3.4` and the proxy appends
 * the real address to the *right* of it. Reading the leftmost entry — which
 * this did — let anyone evade the per-IP limit by rotating a made-up value on
 * every request.
 *
 * So the platform's own headers come first: Vercel sets both of these from the
 * connection itself and overwrites whatever the client sent. `x-forwarded-for`
 * is a last resort, and only its rightmost entry, which is the address the
 * nearest proxy actually observed.
 *
 * Returns null when there is nothing trustworthy — locally, for instance, where
 * none of these are set. That disables the per-IP limit for the attempt rather
 * than inventing a value to count against; the per-identifier limit still
 * applies.
 */
export function clientIpFrom(request: unknown): string | null {
    const headers = (request as { headers?: Headers } | undefined)?.headers
    if (!headers || typeof headers.get !== 'function') return null

    const platform =
        headers.get('x-vercel-forwarded-for')?.trim() || headers.get('x-real-ip')?.trim()
    if (platform) return platform

    const forwarded = headers.get('x-forwarded-for')
    if (forwarded) {
        const hops = forwarded
            .split(',')
            .map((hop) => hop.trim())
            .filter(Boolean)
        const nearest = hops[hops.length - 1]
        if (nearest) return nearest
    }
    return null
}

export class LoginThrottledError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'LoginThrottledError'
    }
}

/**
 * Throws when this identifier or address has failed too often lately.
 *
 * Called before the password is checked, so a locked-out attacker cannot use
 * response timing to tell a real login from a made-up one.
 */
export async function assertNotThrottled(identifier: string, ip: string | null) {
    const since = windowStart(WINDOW_MINUTES)

    const [identifierFailures, ipFailures] = await Promise.all([
        prisma.loginAttempt.count({
            where: { identifier: normalizeIdentifier(identifier), createdAt: { gte: since } },
        }),
        ip
            ? prisma.loginAttempt.count({ where: { ip, createdAt: { gte: since } } })
            : Promise.resolve(0),
    ])

    if (identifierFailures >= MAX_PER_IDENTIFIER || ipFailures >= MAX_PER_IP) {
        // Deliberately does not say which limit tripped, or how many attempts
        // remain — that would tell an attacker how to pace themselves.
        throw new LoginThrottledError(
            `Too many failed sign-in attempts. Try again in ${WINDOW_MINUTES} minutes.`,
        )
    }
}

/** Records one failure, and opportunistically prunes anything long expired. */
export async function recordFailedAttempt(identifier: string, ip: string | null) {
    await prisma.loginAttempt.create({
        data: { identifier: normalizeIdentifier(identifier), ip },
    })
    // Cheap enough to do inline, and saves needing a scheduled job.
    await prisma.loginAttempt.deleteMany({
        where: { createdAt: { lt: windowStart(RETAIN_MINUTES) } },
    })
}

/**
 * Clears an identifier's history after a successful sign-in, so someone who
 * mistypes a few times and then gets it right is not left near the limit.
 */
export async function clearAttempts(identifier: string) {
    await prisma.loginAttempt.deleteMany({
        where: { identifier: normalizeIdentifier(identifier) },
    })
}

export type ThrottleState = {
    throttled: boolean
    /** Whole minutes until the next attempt is allowed. At least 1 when throttled. */
    retryAfterMinutes: number
}

/**
 * Whether this identifier or address is currently locked, and for how long.
 *
 * Exists so the login screen can say something true rather than showing the
 * same "not recognised" for a wrong password and a lockout — a person who has
 * mistyped their password eight times needs to be told to wait, not to keep
 * guessing.
 *
 * Safe to expose unauthenticated: it reveals nothing about whether an account
 * exists, because failures are recorded for unknown logins too, and it says
 * nothing a locked-out person is not about to be told anyway.
 */
export async function describeThrottle(
    identifier: string,
    ip: string | null,
): Promise<ThrottleState> {
    const since = windowStart(WINDOW_MINUTES)
    const normalized = normalizeIdentifier(identifier)

    const [identifierFailures, ipFailures] = await Promise.all([
        prisma.loginAttempt.count({
            where: { identifier: normalized, createdAt: { gte: since } },
        }),
        ip
            ? prisma.loginAttempt.count({ where: { ip, createdAt: { gte: since } } })
            : Promise.resolve(0),
    ])

    const overIdentifier = identifierFailures >= MAX_PER_IDENTIFIER
    const overIp = ipFailures >= MAX_PER_IP
    if (!overIdentifier && !overIp) {
        return { throttled: false, retryAfterMinutes: 0 }
    }

    // The window rolls, so the lock lifts as the oldest attempt in it expires.
    const oldest = await prisma.loginAttempt.findFirst({
        where: overIdentifier
            ? { identifier: normalized, createdAt: { gte: since } }
            : { ip, createdAt: { gte: since } },
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true },
    })

    const liftsAt = (oldest?.createdAt.getTime() ?? Date.now()) + WINDOW_MINUTES * 60 * 1000
    const minutes = Math.ceil((liftsAt - Date.now()) / 60000)

    return { throttled: true, retryAfterMinutes: Math.max(1, minutes) }
}
