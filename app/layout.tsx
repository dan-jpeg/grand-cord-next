import type { Metadata, Viewport } from 'next'
import './globals.css'
import { CartProvider } from '@/contexts/cart-context'

export const metadata: Metadata = {
    title: 'grand-cord',
    description: 'grand-cord studio ',
}

export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
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
            {children}
        </CartProvider>
        </body>
        </html>
    )
}
