import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { formatPrice } from '@/lib/utils'
import { ProductActions } from '@/components/admin/product-actions'

export const dynamic = 'force-dynamic' // Add this line

export default async function ProductsPage() {
    const products = await prisma.product.findMany({
        include: {
            sizes: true,
        },
        orderBy: {
            createdAt: 'desc',
        },
    })

    return (
        <div className="max-w-7xl mx-auto px-6 py-8">
            <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-bold">Products</h2>
                <Link
                    href="/admin/products/new"
                    className="bg-black text-white px-6 py-3 font-medium hover:bg-neutral-800 transition-colors"
                >
                    Add Product
                </Link>
            </div>

            {products.length === 0 ? (
                <div className="bg-white border border-neutral-200 p-12 text-center">
                    <p className="text-neutral-600 mb-4">No products yet</p>
                    <Link
                        href="/admin/products/new"
                        className="text-sm underline hover:no-underline"
                    >
                        Create your first product
                    </Link>
                </div>
            ) : (
                <div className="bg-white border border-neutral-200">
                    <table className="w-full">
                        <thead className="border-b border-neutral-200">
                        <tr>
                            <th className="text-left p-4 font-medium">Name</th>
                            <th className="text-left p-4 font-medium">Designer</th>
                            <th className="text-left p-4 font-medium">Price</th>
                            <th className="text-left p-4 font-medium">Stock</th>
                            <th className="text-left p-4 font-medium">Status</th>
                            <th className="text-right p-4 font-medium">Actions</th>
                        </tr>
                        </thead>
                        <tbody>
                        {products.map((product) => {
                            const totalStock = product.sizes.reduce((sum, size) => sum + size.stock, 0)
                            return (
                                <tr key={product.id} className="border-b border-neutral-200 last:border-0">
                                    <td className="p-4">
                                        <div className="font-medium">{product.name}</div>
                                        <div className="text-sm text-neutral-600">{product.slug}</div>
                                    </td>
                                    <td className="p-4 text-neutral-600">
                                        {product.designerName || '—'}
                                    </td>
                                    <td className="p-4">{formatPrice(product.price)}</td>
                                    <td className="p-4">
                      <span className={totalStock === 0 ? 'text-red-600' : ''}>
                        {totalStock} units
                      </span>
                                    </td>
                                    <td className="p-4">
                      <span
                          className={`inline-block px-2 py-1 text-xs font-medium ${
                              product.published
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-neutral-100 text-neutral-600'
                          }`}
                      >
                        {product.published ? 'Published' : 'Draft'}
                      </span>
                                    </td>
                                    <td className="p-4">
                                        <ProductActions productId={product.id} />
                                    </td>
                                </tr>
                            )
                        })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}