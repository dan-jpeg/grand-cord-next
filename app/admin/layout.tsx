import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// Both branches below carry data-app-zoom="off": the admin renders unscaled at the
// browser's real resolution. The --app-zoom design-width scaling is for the storefront,
// which was designed at a fixed 1800px width; the admin is a dense working UI where
// shrinking everything just costs legibility. Nesting means this covers every /admin
// route, login and pick included. See the opt-out rule in app/globals.css.
export default async function AdminLayout({
                                              children,
                                          }: {
    children: React.ReactNode
}) {
    let session

    try {
        session = await auth()
    } catch (error) {
        console.error('Auth error:', error)
        session = null
    }

    if (!session) {
        return (
            <div data-app-zoom="off" className="min-h-[calc(100*var(--vh))] bg-white flex items-center justify-center">
                {children}
            </div>
        )
    }

    return (
        <div data-app-zoom="off" className="relative min-h-[calc(100*var(--vh))] w-full bg-white">
            {children}
        </div>
    )
}