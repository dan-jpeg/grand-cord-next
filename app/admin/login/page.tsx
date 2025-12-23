import { LoginForm } from '@/components/admin/login-form'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default async function LoginPage() {
    const session = await auth()

    if (session) {
        redirect('/admin')
    }

    return (
        <div className="flex flex-col items-center justify-center h-full">
            <div className="text-2xl font-bold mb-8">ADMIN LOGIN</div>
            <LoginForm />
        </div>
    )
}