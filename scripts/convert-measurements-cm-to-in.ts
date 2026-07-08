import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

function cmToIn(value: string): string | null {
    const n = parseFloat(value)
    if (!Number.isFinite(n)) return null
    // Round to nearest quarter inch.
    const inches = Math.round((n / 2.54) * 4) / 4
    // Trim trailing zeros (e.g. 17.5 not 17.50, 30 not 30.0).
    return inches.toString()
}

async function main() {
    const rows = await prisma.productSizeMeasurement.findMany({
        select: { productSizeId: true, sizingAttributeId: true, value: true },
    })

    let updated = 0
    let skipped = 0
    for (const r of rows) {
        const next = cmToIn(r.value)
        if (next === null || next === r.value) {
            skipped++
            continue
        }
        await prisma.productSizeMeasurement.update({
            where: {
                productSizeId_sizingAttributeId: {
                    productSizeId: r.productSizeId,
                    sizingAttributeId: r.sizingAttributeId,
                },
            },
            data: { value: next },
        })
        updated++
        console.log(`  ${r.value} cm -> ${next} in`)
    }
    console.log(`\nDone. Updated ${updated}, skipped ${skipped}.`)
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(() => prisma.$disconnect())
