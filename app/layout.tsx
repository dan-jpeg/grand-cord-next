import type { Metadata } from 'next'
import './globals.css'
import { CartProvider } from '@/contexts/cart-context'
import { Navigation } from '@/components/store/navigation'

export const metadata: Metadata = {
    title: 'Store',
    description: 'Custom e-commerce store',
}

export default function RootLayout({
                                       children,
                                   }: {
    children: React.ReactNode
}) {
    return (
        <html lang="en">
        <body>
        <CartProvider>
            <Navigation />
            <main className="pt-16">{/* pt-16 accounts for fixed nav */}
                {children}
            </main>
        </CartProvider>
        </body>
        </html>
    )
}