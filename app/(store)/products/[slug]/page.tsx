import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import { ProductDetail } from '@/components/store/product-detail'
import {ProductDetailAlt} from "@/components/store/product-detail-alt";

export default async function ProductPage({
                                              params,
                                          }: {
    params: Promise<{ slug: string }>
}) {
    const { slug } = await params

    const product = await prisma.product.findUnique({
        where: { slug },
        include: { sizes: true },
    })

    if (!product || !product.published) {
        notFound()
    }

    return <ProductDetail product={product} />
}