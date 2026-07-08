import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const MAP = { XS: '1', S: '2', M: '3', L: '4', XL: '5' }

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

const dryRun = process.argv.includes('--dry-run')

async function main() {
    const oldLabels = Object.keys(MAP)

    const sizes = await prisma.productSize.findMany({
        where: { size: { in: oldLabels } },
        select: { id: true, productId: true, size: true },
    })
    const conflicts = await prisma.productSize.findMany({
        where: { size: { in: Object.values(MAP) } },
        select: { productId: true, size: true },
    })
    const conflictSet = new Set(conflicts.map((c) => `${c.productId}::${c.size}`))

    const updates = []
    const collisions = []
    for (const s of sizes) {
        const next = MAP[s.size]
        if (conflictSet.has(`${s.productId}::${next}`)) {
            collisions.push({ productId: s.productId, from: s.size, to: next })
            continue
        }
        updates.push({ id: s.id, from: s.size, to: next })
    }

    const orderItems = await prisma.orderItem.count({ where: { size: { in: oldLabels } } })
    const logs = await prisma.inventoryChangeLog.count({ where: { sizeLabel: { in: oldLabels } } })

    console.log(`ProductSize rewrites: ${updates.length}`)
    console.log(`ProductSize collisions (skipped): ${collisions.length}`)
    if (collisions.length) console.log(collisions)
    console.log(`OrderItem rewrites: ${orderItems}`)
    console.log(`InventoryChangeLog rewrites: ${logs}`)

    if (dryRun) {
        console.log('\n[dry-run] no writes')
        return
    }

    for (const u of updates) {
        await prisma.productSize.update({ where: { id: u.id }, data: { size: u.to } })
    }
    for (const [from, to] of Object.entries(MAP)) {
        await prisma.orderItem.updateMany({ where: { size: from }, data: { size: to } })
        await prisma.inventoryChangeLog.updateMany({
            where: { sizeLabel: from },
            data: { sizeLabel: to },
        })
    }
    console.log('Done.')
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(() => prisma.$disconnect())
