'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { deleteProduct } from '@/app/admin/products/actions'

export function ProductActions({ productId }: { productId: string }) {
    const router = useRouter()
    const [isDeleting, setIsDeleting] = useState(false)

    async function handleDelete() {
        if (!confirm('Are you sure you want to delete this product?')) return

        setIsDeleting(true)
        try {
            await deleteProduct(productId)
            router.refresh()
        } catch (error) {
            alert('Failed to delete product')
            setIsDeleting(false)
        }
    }

    return (
        <div className="flex items-center justify-end gap-2">
            <Link
                href={`/admin/products/${productId}/edit`}
                className="text-sm underline hover:no-underline"
            >
                Edit
            </Link>
            <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="text-sm text-red-600 underline hover:no-underline disabled:opacity-50"
            >
                {isDeleting ? 'Deleting...' : 'Delete'}
            </button>
        </div>
    )
}