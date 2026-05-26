import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { AdminNav } from "@/components/admin/admin-nav"
import { ProductsTable } from '@/components/admin/products-table'
import { getPickUrgency } from '@/lib/pick'

export const dynamic = 'force-dynamic'

export default async function AdminProductsPage() {
    const session = await auth()

    if (!session) {
        redirect('/admin/login')
    }

    const [products, pickUrgency] = await Promise.all([
        prisma.product.findMany({ include: { sizes: true }, orderBy: { createdAt: 'desc' } }),
        getPickUrgency(),
    ])

    return (
        <div className="absolute inset-0 bg-[#d0d9d2]/10 overflow-auto">
            <AdminNav active="inventory" variant="centered" pickUrgency={pickUrgency} />
            <div className="w-full px-4 md:px-6 md:pt-10">
                <ProductsTable products={products} />
            </div>
            <GrainOverlay />
        </div>
    )
}

const NOISE_TILE =
    "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix type='matrix' values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.55 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")"

function GrainOverlay() {
    return (
        <div
            aria-hidden
            className="pointer-events-none fixed inset-0 z-[60] mix-blend-multiply"
            style={{ opacity: 0.07, backgroundImage: NOISE_TILE }}
        />
    )
}