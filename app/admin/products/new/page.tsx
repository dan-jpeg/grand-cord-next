import { ProductForm } from '@/components/admin/product-form'

export default function NewProductPage() {
    return (
        <div className="absolute inset-0 bg-white overflow-auto">
            <div className="min-h-full flex items-start justify-center py-10 px-6">
                <div className="w-full max-w-2xl bg-white border border-neutral-200 text-[0.8em]" style={{borderRadius: '2px'}}>
                    <div className="p-8">
                        <p className="text-xs font-bold uppercase tracking-widest mb-8">New Product</p>
                        <ProductForm />
                    </div>
                </div>
            </div>
        </div>
    )
}