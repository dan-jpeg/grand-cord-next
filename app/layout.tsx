import type { Metadata, Viewport } from 'next'
import './globals.css'
import { CartProvider } from '@/contexts/cart-context'

export const metadata: Metadata = {
    title: 'grand-cord',
    description: 'grand-cord studio ',
    // Stop iOS Safari's Data Detectors from auto-linking the address/phone/etc.
    // in body text (the stray dotted-underline "links" on Apple devices).
    formatDetection: { telephone: false, date: false, address: false, email: false },
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
        <html lang="en" data-scroll-behavior="smooth">
        <body>
        <CartProvider>
            {children}
        </CartProvider>
        </body>
        </html>
    )
}
