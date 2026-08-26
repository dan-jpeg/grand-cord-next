import type { OrderEmailKind, OrderStatus } from '@prisma/client'

/**
 * Which emails make sense for an order in a given state.
 *
 * Plain module rather than living beside the server action, because both the
 * action and the admin table need it and a 'use server' file may only export
 * async functions.
 */

/**
 * What may be sent by hand. Wider than EXPECTED because re-sending history is
 * legitimate — a cancelled order may well have been confirmed and shipped
 * before it was cancelled.
 *
 * PENDING allows nothing: an order that never completed checkout has no
 * customer relationship to mail into.
 */
export const ALLOWED_BY_STATUS: Record<OrderStatus, OrderEmailKind[]> = {
    PENDING: [],
    PAID: ['ORDER_CONFIRMED'],
    SHIPPED: ['ORDER_CONFIRMED', 'ORDER_SHIPPED'],
    CANCELLED: ['ORDER_CONFIRMED', 'ORDER_SHIPPED', 'ORDER_CANCELLED'],
}

/**
 * What the customer should have received by now, so the table can distinguish
 * "never applied" from "should have gone and didn't".
 *
 * An approximation, and knowingly so: an order's status is where it is now, not
 * where it has been. A CANCELLED order that was paid first should also have had
 * a confirmation, but nothing records that it was ever PAID — so only the
 * cancellation is marked expected, and the rest is left to the admin's eye
 * rather than flagged as a false alarm.
 */
export const EXPECTED_BY_STATUS: Record<OrderStatus, OrderEmailKind[]> = {
    PENDING: [],
    PAID: ['ORDER_CONFIRMED'],
    SHIPPED: ['ORDER_CONFIRMED', 'ORDER_SHIPPED'],
    CANCELLED: ['ORDER_CANCELLED'],
}

export const KIND_LABELS: Record<OrderEmailKind, string> = {
    ORDER_CONFIRMED: 'Confirmed',
    ORDER_SHIPPED: 'Shipped',
    ORDER_CANCELLED: 'Cancelled',
}

export const KIND_ORDER: OrderEmailKind[] = [
    'ORDER_CONFIRMED',
    'ORDER_SHIPPED',
    'ORDER_CANCELLED',
]
