import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect, notFound } from 'next/navigation'
import { ProductSizingView } from '@/components/admin/product-sizing-view'

export const dynamic = 'force-dynamic'

const SIZE_ORDER = ['1', '2', '3', '4', '5', 'o/s']

export default async function ProductSizingPage({
    params,
}: {
    params: Promise<{ id: string }>
}) {
    const session = await auth()
    if (!session) redirect('/admin/login')

    const { id } = await params

    const [product, allAttributes] = await Promise.all([
        prisma.product.findUnique({
            where: { id },
            include: {
                sizes: {
                    include: {
                        measurements: { select: { sizingAttributeId: true, value: true } },
                    },
                },
                sizingAttributes: {
                    orderBy: { sortOrder: 'asc' },
                    include: { sizingAttribute: true },
                },
            },
        }),
        prisma.sizingAttribute.findMany({
            where: { enabled: true },
            orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
        }),
    ])

    if (!product) notFound()

    const sortedSizes = [...product.sizes].sort(
        (a, b) => SIZE_ORDER.indexOf(a.size) - SIZE_ORDER.indexOf(b.size),
    )

    return (
        <ProductSizingView
            product={{ id: product.id, name: product.name }}
            sizes={sortedSizes.map((s) => ({
                id: s.id,
                size: s.size,
                measurements: Object.fromEntries(
                    s.measurements.map((m) => [m.sizingAttributeId, m.value]),
                ),
            }))}
            productAttributes={product.sizingAttributes.map((pa) => ({
                id: pa.sizingAttribute.id,
                title: pa.sizingAttribute.title,
                description: pa.sizingAttribute.description,
                category: pa.sizingAttribute.category,
                sortOrder: pa.sortOrder,
            }))}
            allAttributes={allAttributes.map((a) => ({
                id: a.id,
                title: a.title,
                description: a.description,
                category: a.category,
            }))}
        />
    )
}
