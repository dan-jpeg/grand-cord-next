'use server'

import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import bcrypt from 'bcryptjs'

function normalizeEmail(email: string) {
    return email.trim().toLowerCase()
}

export async function createMember(input: { email: string; password: string; name?: string }) {
    const session = await auth()
    if (!session?.user) throw new Error('Not authenticated')

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
    const session = await auth()
    if (!session?.user) throw new Error('Not authenticated')

    await prisma.adminUser.update({
        where: { id: memberId },
        data: { name: name.trim() || null },
    })
    revalidatePath('/admin/members')
    return { ok: true as const }
}

export async function resetMemberPassword(memberId: string, newPassword: string) {
    const session = await auth()
    if (!session?.user) throw new Error('Not authenticated')

    if (!newPassword || newPassword.length < 8) {
        throw new Error('Password must be at least 8 characters')
    }

    const hashed = await bcrypt.hash(newPassword, 10)
    await prisma.adminUser.update({
        where: { id: memberId },
        data: { password: hashed },
    })
    revalidatePath('/admin/members')
    return { ok: true as const }
}

export async function deleteMember(memberId: string) {
    const session = await auth()
    if (!session?.user) throw new Error('Not authenticated')

    if (session.user.id === memberId) {
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
