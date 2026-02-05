    'use client'

    import Image from 'next/image'
    import { motion } from 'framer-motion'
    import { formatPrice } from '@/lib/utils'
    import { useCart } from '@/contexts/cart-context'

    export function CartCardBen({ item }: { item: any }) {
        const { removeItem } = useCart()

        return (
            <div className="flex  font-inter justify-center">
                <motion.div
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="grid grid-cols-[120px_120px_140px] items-start"
                >
                    {/* PHOTO */}
                    <div className="relative w-[119x] h-[160px] bg-[#f2f2f2]">
                        <Image
                            src={item.image}
                            alt={item.productName}
                            fill
                            className="object-contain"
                        />
                    </div>

                    {/* META COLUMN */}
                    <div className="flex  py-4 bg-blue-600/0 justify-between text-[8pt]">
                        {/* Quantity */}
                        <span className="pl-8 font-bold">{item.quantity}</span>

                        {/* Right stack */}
                        <div className="flex bg-blue-600/0 flex-col items-end gap-6">
                            <span>{formatPrice(item.price)}. 00</span>

                            <span className="">
                    size {item.size}
                </span>

                            <button
                                onClick={() => removeItem(item.productId, item.size)}
                                className="underline hover:no-underline"
                            >
                                remove
                            </button>
                        </div>
                    </div>

                    {/* DETAILS COLUMN */}
                    <div className="text-[8pt]   py-4 text-right bg-blue-600/0 space-y-0">
                        {/* Product Name */}
                        <div className="uppercase text-right font-bold tracking-wide mb-6">
                            {item.productName}

                        </div>

                        {/* Material */}
                        <div>
                            {item.material}
                        </div>

                        {/* Color */}
                        <div>
                            {item.color}
                        </div>
                    </div>
                </motion.div>
            </div>
        )
    }