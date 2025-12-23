import type { Metadata } from 'next'
import localFont from 'next/font/local'
import './globals.css'
import { CartProvider } from '@/contexts/cart-context'
import { Navigation } from '@/components/store/navigation'

const alteHaas = localFont({
    src: [
        {
            path: '../public/fonts/AlteHaasGroteskRegular.ttf',
            weight: '400',
            style: 'normal',
        },
        {
            path: '../public/fonts/AlteHaasGroteskBold.ttf',
            weight: '700',
            style: 'normal',
        },
    ],
    variable: '--font-alte',
})

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
        <html lang="en" className={alteHaas.variable}>
        <body>
        <CartProvider>
            {children}
        </CartProvider>
        </body>
        </html>
    )
}