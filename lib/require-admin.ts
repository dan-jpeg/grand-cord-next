import { auth } from '@/lib/auth'

export type AdminSessionUser = {
    id: string
    email?: string | null
    name?: string | null
}

/**
 * Guard for admin server actions. Server actions are POST endpoints reachable by
 * anyone who can reach the deployment, so every mutating admin action has to
 * assert a session for itself — a page-level or layout-level check does not
 * cover them.
 *
 * Returns the acting admin so callers can attribute audit rows.
 */
export async function requireAdmin(): Promise<AdminSessionUser> {
    const session = await auth()
    if (!session?.user) throw new Error('Unauthorized')
    return session.user as AdminSessionUser
}
