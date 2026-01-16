'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

type AdminNavProps = {
    active: 'orders' | 'inventory' | 'catalog' | 'more'
    variant?: 'centered' | 'top-left'
}

export function AdminNav({ active, variant = 'top-left' }: AdminNavProps) {
    const pathname = usePathname()

    if (variant === 'top-left') {
        return (
            <div className="absolute top-3 left-3 flex z-[300] items-start text-[8pt] font-bold gap-4 ">
                <Link
                    href="/admin/orders"
                    className={active === 'orders' ? 'underline decoration-2 underline-offset-3' : 'hover:underline hover:decoration-2 hover:underline-offset-3'}
                >
                    Orders
                </Link>
                <Link
                    href="/admin/products"
                    className={active === 'inventory' ? 'underline decoration-2 underline-offset-3' : 'hover:underline hover:decoration-2 hover:underline-offset-3'}
                >
                    Inventory
                </Link>
                <Link
                    href="/admin/products"
                    className={active === 'catalog' ? 'underline decoration-2 underline-offset-3' : 'hover:underline hover:decoration-2 hover:underline-offset-3'}
                >
                    Catalog
                </Link>
                <Link
                    href="/admin"
                    className={active === 'more' ? 'underline decoration-2 underline-offset-3' : 'hover:underline hover:decoration-2 hover:underline-offset-3'}
                >
                    More
                </Link>
            </div>
        )
    }

    return (
        <div className="flex items-start text-[8pt] font-bold justify-center gap-4 py-6">
            <Link
                href="/admin/orders"
                className={active === 'orders' ? 'underline decoration-2 underline-offset-3' : 'hover:underline hover:decoration-2 hover:underline-offset-3'}
            >
                Orders
            </Link>
            <Link
                href="/admin/products"
                className={active === 'inventory' ? 'underline decoration-2 underline-offset-3' : 'hover:underline hover:decoration-2 hover:underline-offset-3'}
            >
                Inventory
            </Link>
            <Link
                href="/admin/products"
                className={active === 'catalog' ? 'underline decoration-2 underline-offset-3' : 'hover:underline hover:decoration-2 hover:underline-offset-3'}
            >
                Catalog
            </Link>
            <Link
                href="/admin"
                className={active === 'more' ? 'underline decoration-2 underline-offset-3' : 'hover:underline hover:decoration-2 hover:underline-offset-3'}
            >
                More
            </Link>
        </div>
    )
}