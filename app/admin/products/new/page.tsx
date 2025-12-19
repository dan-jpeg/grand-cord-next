import { ProductForm } from '@/components/admin/product-form'

export default function NewProductPage() {
    return (
        <div className="max-w-4xl mx-auto px-6 py-8">
            <h2 className="text-2xl font-bold mb-8">Add Product</h2>
            <ProductForm />
        </div>
    )
}