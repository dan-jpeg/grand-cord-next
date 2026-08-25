'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { checkLoginThrottle } from '@/app/admin/login/actions'

export function LoginForm() {
    const router = useRouter()
    const [identifier, setIdentifier] = useState('')
    const [password, setPassword] = useState('')
    const [message, setMessage] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const canSubmit = identifier.trim().length > 0 && password.length > 0
    const hasError = message !== null

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (!canSubmit || isLoading) return
        setMessage(null)
        setIsLoading(true)

        try {
            const result = await signIn('credentials', {
                identifier,
                password,
                redirect: false,
            })

            if (result?.error) {
                // NextAuth does not carry authorize()'s message back here, so a
                // lockout and a wrong password arrive identically. Ask the
                // server which it was — telling someone to keep guessing when
                // they are already locked out is the one unhelpful answer.
                const state = await checkLoginThrottle(identifier).catch(() => null)
                setMessage(
                    state?.throttled
                        ? `Too many failed attempts. Try again in ${state.retryAfterMinutes} ` +
                          `minute${state.retryAfterMinutes === 1 ? '' : 's'}.`
                        : 'Login or password not recognised.',
                )
            } else {
                router.push('/admin')
                router.refresh()
            }
        } catch {
            setMessage('Could not reach the server. Check your connection and try again.')
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
                    onChange={(e) => {
                        setIdentifier(e.target.value)
                        setMessage(null)
                    }}
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
                    onChange={(e) => {
                        setPassword(e.target.value)
                        setMessage(null)
                    }}
                    className={`w-full h-10 px-3 bg-neutral-200 text-[11px] tracking-[0.18em] border-0 rounded-none outline-none ${
                        hasError ? 'bg-neutral-300' : ''
                    }`}
                    required
                />
                {message && (
                    <p
                        role="alert"
                        aria-live="polite"
                        className="px-3 pt-1 text-[11px] leading-[1.5] tracking-[0.14em] text-[#8a0000]"
                    >
                        {message}
                    </p>
                )}
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
