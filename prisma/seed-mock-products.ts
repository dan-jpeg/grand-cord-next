import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { slugify } from '../lib/utils'
import { config } from 'dotenv'

config({ path: '.env' })
config({ path: '.env.local', override: true })

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

const IMAGE_URL = 'https://utfs.io/f/r8GYFhM0VCIFU1f50xKiTt1xan3bWkqPhdR6VcADBm0QySLp'

const NAMES = [
    'Onecut Pants',
    'Grand Cord Jacket',
    'Linen Skirt',
    'Wool Overcoat',
    'Selvedge Trouser',
    'Cropped Blazer',
    'Field Shirt',
    'Box Tee',
    'Pleated Pant',
    'Patch Cardigan',
    'Twill Vest',
    'Bias Skirt',
    'Cord Shorts',
    'Wide Trouser',
    'Mohair Sweater',
    'Cotton Smock',
    'Workwear Jacket',
    'Soft Knit',
    'Roll Neck',
    'Quilted Liner',
]

const MATERIALS = ['Cotton', 'Wool', 'Linen', 'Corduroy', 'Mohair', 'Silk', 'Twill']
const COLORS = [
    { name: 'Black', hex: '#000000' },
    { name: 'Cream', hex: '#f5efe3' },
    { name: 'Olive', hex: '#5f6a4a' },
    { name: 'Stone', hex: '#a99f8d' },
    { name: 'Charcoal', hex: '#373737' },
    { name: 'Ivory', hex: '#f1ead9' },
    { name: 'Rust', hex: '#a44a2d' },
]
const DESIGNERS = [
    'Benjamin Zumbrun',
    'Caroline Chilipala',
    'Mara Kallen',
    'Tomo Ueda',
    'Lila Adair',
    'Saul Vance',
]
const SIZES = ['1', '2', '3', '4', '5']

function pick<T>(arr: T[], i: number): T {
    return arr[i % arr.length]
}

async function main() {
    console.log('Seeding 20 mock products…')
    for (let i = 0; i < NAMES.length; i++) {
        const name = `${NAMES[i]} ${String(i + 1).padStart(2, '0')}`
        const slug = slugify(name)
        const material = pick(MATERIALS, i)
        const color = pick(COLORS, i)
        const designer = pick(DESIGNERS, i)
        const designer2 = pick(DESIGNERS, i + 3)
        const price = 80 + (i % 8) * 35
        const published = i % 7 !== 0

        const images = [
            {
                url: IMAGE_URL,
                isMobilePrimary: true,
                isDesktopPrimary: true,
                isCartPrimary: true,
            },
        ]

        // Stock pattern: vary in-stock vs low vs zero
        const stockPattern = i % 4
        const sizes = SIZES.map((size, sIdx) => {
            let available = 0
            if (stockPattern === 0) available = 4 + sIdx
            else if (stockPattern === 1) available = sIdx < 2 ? 1 : 0
            else if (stockPattern === 2) available = 0
            else available = 2 + (sIdx % 3)
            return {
                size,
                available,
                committed: 0,
                total: available,
            }
        })

        await prisma.product.upsert({
            where: { slug },
            update: {
                name,
                material,
                color: color.name,
                colorHex: color.hex,
                price,
                published,
                designerNames: [designer, designer2],
                images: images as unknown as object,
                sizes: {
                    deleteMany: {},
                    create: sizes,
                },
            },
            create: {
                name,
                slug,
                description: `Mock seed product #${i + 1}.`,
                material,
                color: color.name,
                colorHex: color.hex,
                price,
                published,
                designerNames: [designer, designer2],
                keywords: ['mock', 'seed', material.toLowerCase()],
                images: images as unknown as object,
                sizes: { create: sizes },
            },
        })
        console.log(`  ✓ ${name}`)
    }
    console.log('Done.')
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(() => prisma.$disconnect())
