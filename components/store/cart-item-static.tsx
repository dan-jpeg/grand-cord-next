'use client'

import { formatPrice } from '@/lib/utils'
import type { CartItem } from '@/contexts/cart-context'

type CartItemTextStaticProps = {
    item: CartItem
    index: number
}

const getSizeNumber = (size: string): number => {
    const sizeMap: Record<string, number> = {
        '1': 1,
        '2': 2,
        '3': 3,
        '4': 4,
        '5': 5,
        'o/s': 0,
    }
    return sizeMap[size] ?? 0
}

export function CartItemTextStatic({ item, index }: CartItemTextStaticProps) {
    return (
        <div className="relative">
            {/* Index Number */}
            <div className="absolute -left-[36px] font-bold top-0 text-[10pt]">
                {index + 1}.
            </div>

            <div className="mr-5">
                <h3 className="text-[10pt] -mb-1 font-bold uppercase">{item.productName}</h3>
            </div>

            <div className="font-bold text-[10pt]">
                <div className="-mb-1">Size: {getSizeNumber(item.size)}</div>
                {item.material && <div className="-mb-1 lowercase">{item.material}</div>}
                <div className="font-bold">{formatPrice(item.price * item.quantity)}</div>
            </div>

            {/* Reserve space for consistency with interactive version */}
            <div className="mt-3 h-6" />
        </div>
    )
}