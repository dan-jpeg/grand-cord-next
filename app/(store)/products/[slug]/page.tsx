import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import { ProductDetail } from '@/components/store/product-detail'
import {ProductDetailAlt} from "@/components/store/product-detail-alt";
import {ProductDetailBen} from "@/components/store/product-detail-ben";

export default async function ProductPage({
                                              params,
                                          }: {
    params: Promise<{ slug: string }>
}) {
    const { slug } = await params

    const product = await prisma.product.findUnique({
        where: { slug },
        include: {
            sizes: {
                include: {
                    measurements: { select: { sizingAttributeId: true, value: true } },
                },
            },
            sizingAttributes: {
                orderBy: { sortOrder: 'asc' },
                include: {
                    sizingAttribute: {
                        select: { id: true, title: true, description: true },
                    },
                },
            },
        },
    })

    if (!product || !product.published) {
        notFound()
    }

    return <ProductDetailBen product={product} />
}