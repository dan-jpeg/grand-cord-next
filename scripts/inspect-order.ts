import 'dotenv/config'
import { prisma } from '../lib/prisma'

/**
 * Read-only view of an order, the stock it touches, and its audit trail.
 *
 * Written for verifying the webhook handlers: after each Stripe event you want
 * to see three things at once — the order's status, whether the counters moved,
 * and whether an InventoryChangeLog row was written. That last one is the tell.
 * The old expiry handler moved stock without logging anything, so a stock
 * change with no matching row means the guarded path was bypassed.
 *
 * Usage:  npx tsx scripts/inspect-order.ts 0004
 *         npx tsx scripts/inspect-order.ts            (most recent order)
 */
async function main() {
    const wanted = process.argv[2]

    const order = wanted
        ? await prisma.order.findUnique({
              where: { orderNumber: wanted },
              include: { items: true },
          })
        : await prisma.order.findFirst({
              orderBy: { createdAt: 'desc' },
              include: { items: true },
          })

    if (!order) {
        console.log(wanted ? `No order ${wanted}.` : 'No orders yet.')
        return
    }

    const intentKind = order.stripePaymentIntentId === 'pending'
        ? 'sentinel (no Stripe session yet)'
        : order.stripePaymentIntentId.startsWith('cs_')
          ? 'checkout session — payment not completed'
          : 'payment intent'

    console.log(`ORDER #${order.orderNumber}`)
    console.log(`  status  ${order.status}`)
    console.log(`  total   ${order.total}`)
    console.log(`  stripe  ${order.stripePaymentIntentId}  (${intentKind})`)
    console.log(`  placed  ${order.createdAt.toISOString().slice(0, 16)}`)
    if (order.trackingNumber) console.log(`  tracking ${order.trackingNumber}`)

    console.log(`\n  ITEMS`)
    for (const item of order.items) {
        console.log(`    ${item.productName} (${item.size}) x${item.quantity} @ ${item.price}`)
        const size = await prisma.productSize.findFirst({
            where: { productId: item.productId, size: item.size },
            select: { available: true, committed: true, total: true },
        })
        if (!size) {
            console.log(`      no matching size row`)
            continue
        }
        const ok = size.total === size.available + size.committed && size.committed >= 0
        console.log(
            `      stock: available=${size.available} committed=${size.committed} ` +
                `total=${size.total}  ${ok ? '✅' : '❌ INVARIANT BROKEN'}`,
        )
    }

    const logs = await prisma.inventoryChangeLog.findMany({
        where: { orderId: order.id },
        orderBy: { createdAt: 'asc' },
    })

    console.log(`\n  AUDIT TRAIL (${logs.length} row${logs.length === 1 ? '' : 's'})`)
    if (logs.length === 0) {
        console.log(`    none — any stock movement for this order bypassed the guarded path`)
    }
    for (const log of logs) {
        console.log(
            `    ${log.createdAt.toISOString().slice(0, 16)}  ${String(log.reason).padEnd(16)} ` +
                `${String(log.field)}: ${log.before}→${log.after} ` +
                `(${log.delta > 0 ? '+' : ''}${log.delta})  by=${log.adminEmail}`,
        )
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
