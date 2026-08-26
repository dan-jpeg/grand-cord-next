'use server'

import type { OrderEmailKind } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/require-admin'
import { resendOrderEmail } from '@/lib/email/order-emails'
import { ALLOWED_BY_STATUS } from '@/lib/email/policy'
import { revalidatePath } from 'next/cache'

export async function resendOrderEmailAction(
    orderId: string,
    kind: OrderEmailKind,
): Promise<{ ok: true; status: string } | { ok: false; error: string }> {
    await requireAdmin()

    const order = await prisma.order.findUnique({
        where: { id: orderId },
        select: { status: true, orderNumber: true },
    })
    if (!order) return { ok: false, error: 'Order not found' }

    if (!ALLOWED_BY_STATUS[order.status].includes(kind)) {
        return {
            ok: false,
            error: `Order ${order.orderNumber} is ${order.status}; a ${kind} email would be untrue.`,
        }
    }

    const outcome = await resendOrderEmail(orderId, kind)

    revalidatePath('/admin/emails')

    if (outcome.status === 'failed') return { ok: false, error: outcome.error }
    if (outcome.status === 'disabled') {
        return { ok: false, error: 'Email is not configured in this environment.' }
    }
    return { ok: true, status: outcome.status }
}
