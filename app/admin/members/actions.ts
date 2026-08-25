'use server'

import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/require-admin'
import { revalidatePath } from 'next/cache'
import bcrypt from 'bcryptjs'

function normalizeEmail(email: string) {
    return email.trim().toLowerCase()
}

/**
 * Proves the caller is who their session says they are.
 *
 * A session cookie alone was enough to rewrite every other member's password
 * and lock the team out — including a session someone else had got hold of.
 * Re-entering the password is what separates "this browser has a cookie" from
 * "this person is the admin".
 */
async function confirmActingAdminPassword(actorId: string, currentPassword: string) {
    if (!currentPassword) {
        throw new Error('Enter your own password to confirm this change')
    }

    const actor = await prisma.adminUser.findUnique({
        where: { id: actorId },
        select: { password: true },
    })
    if (!actor) throw new Error('Your account no longer exists')

    const valid = await bcrypt.compare(currentPassword, actor.password)
    if (!valid) throw new Error('That is not your current password')
}

export async function createMember(input: { email: string; password: string; name?: string }) {
    await requireAdmin()

    const email = normalizeEmail(input.email)
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
        throw new Error('Valid email is required')
    }
    if (!input.password || input.password.length < 8) {
        throw new Error('Password must be at least 8 characters')
    }

    const existing = await prisma.adminUser.findUnique({ where: { email } })
    if (existing) throw new Error('A member with that email already exists')

    const hashed = await bcrypt.hash(input.password, 10)
    await prisma.adminUser.create({
        data: {
            email,
            name: input.name?.trim() || null,
            password: hashed,
        },
    })

    revalidatePath('/admin/members')
    return { ok: true as const }
}

export async function updateMemberName(memberId: string, name: string) {
    await requireAdmin()

    await prisma.adminUser.update({
        where: { id: memberId },
        data: { name: name.trim() || null },
    })
    revalidatePath('/admin/members')
    return { ok: true as const }
}

export async function resetMemberPassword(
    memberId: string,
    newPassword: string,
    currentPassword: string,
) {
    const actor = await requireAdmin()

    if (!newPassword || newPassword.length < 8) {
        throw new Error('Password must be at least 8 characters')
    }

    await confirmActingAdminPassword(actor.id, currentPassword)

    const hashed = await bcrypt.hash(newPassword, 10)
    await prisma.adminUser.update({
        where: { id: memberId },
        data: { password: hashed },
    })
    revalidatePath('/admin/members')
    return { ok: true as const }
}

export async function deleteMember(memberId: string, currentPassword: string) {
    const actor = await requireAdmin()

    await confirmActingAdminPassword(actor.id, currentPassword)

    if (actor.id === memberId) {
        throw new Error("You can't remove your own account")
    }

    const count = await prisma.adminUser.count()
    if (count <= 1) {
        throw new Error('Cannot remove the last remaining member')
    }

    await prisma.adminUser.delete({ where: { id: memberId } })
    revalidatePath('/admin/members')
    return { ok: true as const }
}
