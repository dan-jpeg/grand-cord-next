import 'dotenv/config'
import { prisma } from '../lib/prisma'

/**
 * One-off repair for size rows whose `committed` has gone negative.
 *
 * A negative `committed` means a reservation was released more times than it
 * was taken — the unguarded `decrement` in the expired-checkout webhook running
 * alongside an admin cancel for the same order. It is invisible to the admin
 * stock panel, which only ever writes `available` and then recomputes
 * `total = available + committed`, so every subsequent correction silently
 * carries the bad number forward.
 *
 * `available` is trusted as-is: it is what the admin last set deliberately.
 * `committed` is rebuilt from what open (PENDING/PAID) orders actually hold,
 * and `total` follows from the two.
 *
 * Run with:  npx tsx scripts/repair-negative-committed.ts
 * Add --dry to print the changes without writing them.
 */
async function main() {
    const dryRun = process.argv.includes('--dry')

    const rows = await prisma.productSize.findMany({
        where: { committed: { lt: 0 } },
        select: {
            id: true,
            productId: true,
            size: true,
            available: true,
            committed: true,
            total: true,
            product: { select: { name: true } },
        },
    })

    if (rows.length === 0) {
        console.log('No rows with negative committed. Nothing to do.')
        return
    }

    console.log(`${rows.length} row(s) to repair${dryRun ? ' (dry run)' : ''}\n`)

    for (const row of rows) {
        const held = await prisma.orderItem.aggregate({
            where: {
                productId: row.productId,
                size: row.size,
                order: { status: { in: ['PENDING', 'PAID'] } },
            },
            _sum: { quantity: true },
        })
        const committed = held._sum.quantity ?? 0
        const total = row.available + committed

        console.log(`${row.product.name} (${row.size})`)
        console.log(`  before: available=${row.available} committed=${row.committed} total=${row.total}`)
        console.log(`  after : available=${row.available} committed=${committed} total=${total}`)

        if (dryRun) {
            console.log('')
            continue
        }

        await prisma.$transaction(async (tx) => {
            await tx.productSize.update({
                where: { id: row.id },
                data: { committed, total },
            })
            // Recorded so the correction is not itself invisible.
            await tx.inventoryChangeLog.create({
                data: {
                    productId: row.productId,
                    productSizeId: row.id,
                    productName: row.product.name,
                    sizeLabel: row.size,
                    field: 'committed',
                    delta: committed - row.committed,
                    before: row.committed,
                    after: committed,
                    reason: 'MANUAL_CORRECTION',
                    adminEmail: 'system',
                    adminName: 'repair-negative-committed script',
                },
            })
        })

        const after = await prisma.productSize.findUnique({
            where: { id: row.id },
            select: { available: true, committed: true, total: true },
        })
        const ok =
            after !== null &&
            after.committed >= 0 &&
            after.total === after.available + after.committed
        console.log(`  ${ok ? '✅ repaired' : '❌ still wrong'}\n`)
    }

    if (dryRun) {
        console.log('Dry run — nothing was written. Re-run without --dry to apply.')
        return
    }

    const remaining = await prisma.productSize.count({ where: { committed: { lt: 0 } } })
    console.log(`${remaining} row(s) with negative committed remaining.`)
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
