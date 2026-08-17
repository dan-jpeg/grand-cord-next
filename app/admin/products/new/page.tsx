import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { createDraftProduct } from '@/app/admin/products/actions'

// No separate create form — "New Item +" spins up a blank draft and hands the
// user the normal product edit view with every field empty.
export const dynamic = 'force-dynamic'

export default async function NewProductPage() {
    const session = await auth()
    if (!session) {
        redirect('/admin/login')
    }

    const id = await createDraftProduct()
    redirect(`/admin/products/${id}/edit`)
}
