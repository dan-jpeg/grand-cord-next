import Link from 'next/link'

type AdminNavProps = {
    active: 'orders' | 'inventory' | 'catalog' | 'more'
}

export function AdminNav({ active }: AdminNavProps) {
    return (
        <div className="flex items-center h-[30vh] text-[8pt] font-bold justify-center gap-4 py-6">
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
                className={active === 'catalog' ? 'underline decoration-2  underline-offset-3' : 'hover:underline hover:decoration-2 hover:underline-offset-3'}
            >
                Catalog
            </Link>
            <Link
                href="/admin"
                className={active === 'more' ? 'underline decoration-2 underline-offset-3' : 'hover:underline  hover:decoration-2 hover:underline-offset-3'}
            >
                More
            </Link>
        </div>
    )
}