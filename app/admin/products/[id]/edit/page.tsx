import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ProductDetailView } from '@/components/admin/product-detail-view'

export default async function ProductDetailPage({
                                                    params,
                                                }: {
    params: Promise<{ id: string }>
}) {
    const session = await auth()
    if (!session) {
        redirect('/admin/login')
    }

    const { id } = await params

    const product = await prisma.product.findUnique({
        where: { id },
        include: {
            sizes: true,
        },
    })

    if (!product) {
        notFound()
    }

    // Get orders that include this product
    const orders = await prisma.order.findMany({
        where: {
            items: {
                some: {
                    productId: id,
                },
            },
        },
        include: {
            items: {
                where: {
                    productId: id,
                },
            },
        },
        orderBy: {
            createdAt: 'desc',
        },
        take: 20,
    })

    const inventoryLogs = await prisma.inventoryChangeLog.findMany({
        where: { productId: id },
        orderBy: { createdAt: 'desc' },
        take: 100,
    })

    return (
        <div className="absolute inset-0 bg-white overflow-auto">
            <div className="min-h-full flex items-start justify-center py-10 px-6">
                <div className="w-full max-w-2xl bg-white border border-neutral-200 text-[0.8em]" style={{borderRadius: '2px'}}>
                    <ProductDetailView product={product} orders={orders} inventoryLogs={inventoryLogs} />
                </div>
            </div>
        </div>
    )
}