import { LoginForm } from '@/components/admin/login-form'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function LoginPage() {
    const session = await auth()

    if (session) {
        redirect('/admin')
    }

    return (
        <div className="w-full min-h-screen bg-white">
            <LoginForm />
        </div>
    )
}
