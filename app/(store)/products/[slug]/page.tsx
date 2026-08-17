import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import { auth } from '@/lib/auth'
import { ProductDetail } from '@/components/store/product-detail'
import {ProductDetailAlt} from "@/components/store/product-detail-alt";
import {ProductDetailBen} from "@/components/store/product-detail-ben";

export default async function ProductPage({
                                              params,
                                              searchParams,
                                          }: {
    params: Promise<{ slug: string }>
    searchParams: Promise<{ preview?: string }>
}) {
    const { slug } = await params
    const { preview } = await searchParams

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

    if (!product) {
        notFound()
    }

    // Unlisted items have no public page, but admins need to see one before
    // listing. ?preview=1 renders the real store page for a signed-in admin —
    // nothing else changes, so what they see is what shoppers will get. The
    // session check only runs for unpublished products, so normal product
    // pages aren't pushed into per-request rendering by reading cookies.
    let isPreview = false
    if (!product.published) {
        if (preview !== '1') notFound()
        const session = await auth()
        if (!session) notFound()
        isPreview = true
    }

    return (
        <>
            {isPreview && (
                <div className="fixed bottom-3 left-1/2 -translate-x-1/2 z-[200] flex items-center bg-[#e8e6e6] px-2 h-[13px] pointer-events-none">
                    <span className="text-[12px] font-bold leading-none">Preview — unlisted</span>
                </div>
            )}
            <ProductDetailBen product={product} />
        </>
    )
}
