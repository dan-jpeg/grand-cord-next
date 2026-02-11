'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'

export function LoginForm() {
    const router = useRouter()
    const [identifier, setIdentifier] = useState('')
    const [password, setPassword] = useState('')
    const [hasError, setHasError] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const canSubmit = identifier.trim().length > 0 && password.length > 0

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (!canSubmit || isLoading) return
        setHasError(false)
        setIsLoading(true)

        try {
            const result = await signIn('credentials', {
                identifier,
                password,
                redirect: false,
            })

            if (result?.error) {
                setHasError(true)
            } else {
                router.push('/admin')
                router.refresh()
            }
        } catch {
            setHasError(true)
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <form onSubmit={handleSubmit} className="w-full">
            <div className="fixed top-0 left-0 right-0 z-20 px-4 pt-2 sm:px-8 sm:pt-4 space-y-1">
                <input
                    id="identifier"
                    type="text"
                    aria-label="Login"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    className={`w-full h-10 px-3 bg-neutral-200 text-[11px] tracking-[0.18em] border-0 rounded-none outline-none ${
                        hasError ? 'bg-neutral-300' : ''
                    }`}
                    required
                />
                <input
                    id="password"
                    type="password"
                    aria-label="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={`w-full h-10 px-3 bg-neutral-200 text-[11px] tracking-[0.18em] border-0 rounded-none outline-none ${
                        hasError ? 'bg-neutral-300' : ''
                    }`}
                    required
                />
            </div>

            {canSubmit && (
                <button
                    type="submit"
                    aria-label="Submit login"
                    disabled={isLoading}
                    className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[90px] leading-none tracking-[0.24em] text-black/85 hover:text-black disabled:opacity-30"
                >
                    ▸
                </button>
            )}
        </form>
    )
}
