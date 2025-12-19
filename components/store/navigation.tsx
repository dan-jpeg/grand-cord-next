'use client'

import Link from 'next/link'
import { useCart } from '@/contexts/cart-context'
import Image from 'next/image'

export function Navigation() {
    const { totalItems } = useCart()

    return (
        <nav className="  top-0 left-0 right-0   border-black z-50">
            <div className=" mx-auto px-8 py-4 flex items-center justify-between">
                <Link href="/" className="fixed z-50 text-[9pt] font-bold uppercase hover:underline">
                    ⚉
                </Link>
                <p> . </p>
                <Link href="/cart" className="relative flex items-center gap-2 hover:opacity-70 transition-opacity">
                    <Image
                        src="/cart.svg"
                        alt="Cart"
                        width={24}
                        height={32}
                        className="w-5 h-5"
                    />
                    {totalItems > -1 && (
                        <span className="text-[9pt] font-bold">({totalItems})</span>
                    )}
                </Link>
            </div>
        </nav>
    )
}
