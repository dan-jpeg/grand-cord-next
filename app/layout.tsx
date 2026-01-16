import type { Metadata } from 'next'
import './globals.css'
import { CartProvider } from '@/contexts/cart-context'

export const metadata: Metadata = {
    title: 'Grand Cord',
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
            {children}
        </CartProvider>
        </body>
        </html>
    )
}