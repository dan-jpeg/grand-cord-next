import { LoginForm } from '@/components/admin/login-form'

import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default async function LoginPage() {


    const session = await auth()

    if (!session) {
        redirect('/admin/login')
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-neutral-50">
            <div className="w-full max-w-md px-8">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold mb-2">Admin Login</h1>
                    <p className="text-neutral-600">Sign in to access the dashboard</p>
                </div>
                <LoginForm />
            </div>
        </div>
    )
}

