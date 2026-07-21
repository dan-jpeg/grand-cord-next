'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

// Next.js client-side navigation doesn't scroll to hash fragments the way a
// full page load does. Mount this once per route that receives hash-linked
// traffic; on mount and on hash changes it scrolls the target into view.
export function ScrollToHash() {
    const pathname = usePathname()

    useEffect(() => {
        const hash = window.location.hash.slice(1)
        if (!hash) return

        // The target may not exist yet on the first tick after client-side nav;
        // poll briefly until it appears (or give up).
        let attempts = 0
        const timer = setInterval(() => {
            const el = document.getElementById(hash)
            if (el) {
                clearInterval(timer)
                // CSS `html { scroll-behavior: smooth }` interferes with
                // programmatic scroll during client-side navigation, so
                // briefly toggle it off, scroll, then restore.
                const prev = document.documentElement.style.scrollBehavior
                document.documentElement.style.scrollBehavior = 'auto'
                el.scrollIntoView({ block: 'start' })
                document.documentElement.style.scrollBehavior = prev
                return
            }
            if (attempts++ > 30) clearInterval(timer)
        }, 50)

        return () => clearInterval(timer)
    }, [pathname])

    useEffect(() => {
        const onHash = () => {
            const hash = window.location.hash.slice(1)
            if (!hash) return
            const el = document.getElementById(hash)
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
        window.addEventListener('hashchange', onHash)
        return () => window.removeEventListener('hashchange', onHash)
    }, [])

    return null
}
