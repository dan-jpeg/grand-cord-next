import { prisma } from '@/lib/prisma'
import { ProductForm } from '@/components/admin/product-form'
import { notFound } from 'next/navigation'

export default async function EditProductPage({
                                                  params,
                                              }: {
    params: Promise<{ id: string }>
}) {
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

    return (
        <div className="max-w-4xl mx-auto px-6 py-8">
            <h2 className="text-2xl font-bold mb-8">Edit Product</h2>
            <ProductForm product={product} />
        </div>
    )
}