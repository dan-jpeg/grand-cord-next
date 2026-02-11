'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useCart } from '@/contexts/cart-context'
import type { Product, ProductSize } from '@prisma/client'
import { motion } from 'framer-motion'
import { formatDesignerNames } from '@/lib/designers'

type ImageData = {
    url: string
    isMobilePrimary: boolean
    isDesktopPrimary: boolean
}

type ProductWithSizes = Product & {
    sizes: ProductSize[]
}

export function ProductDetailBen({ product }: { product: ProductWithSizes }) {
    const { addItem } = useCart()
    const [selectedSize, setSelectedSize] = useState<string>('')
    const [showSizing, setShowSizing] = useState(false)
    const [buttonState, setButtonState] = useState<'idle' | 'added'>('idle')

    const images = product.images as unknown as ImageData[]
    const designerLabel = formatDesignerNames(product.designerNames)
    const displayImage = images.find(img => img.isDesktopPrimary)?.url || images[0]?.url

    // Repeat the image 4 times for scrolling
    const imageArray = displayImage ? [displayImage, displayImage, displayImage, displayImage] : []

    const availableSizes = product.sizes
        .filter(s => s.available > 0)
        .sort((a, b) => {
            const order = ['XS', 'S', 'M', 'L', 'XL', 'XXL']
            return order.indexOf(a.size) - order.indexOf(b.size)
        })

    function handleAdd() {
        if (!selectedSize) {
            alert('Please select a size')
            return
        }

        addItem({
            productId: product.id,
            productName: product.name,
            productSlug: product.slug,
            size: selectedSize,
            price: product.price,
            image: displayImage,
            material: product.material || undefined,
            color: product.color || undefined,
        })

        setButtonState('added')
        setTimeout(() => setButtonState('idle'), 2000)
    }
    // Placeholder measurements - would come from database in production
    const measurements = [
        { value: '30', label: 'length', description: 'back of collar to bottom hem' },
        { value: '17', label: 'chest', description: 'underarm to underarm' },
        { value: '37', label: 'waist', description: 'circumference closed' },
        { value: '7', label: 'shoulder', description: 'collar to shoulder' },
        { value: '20', label: 'sleeve', description: 'shoulder to cuff' },
        { value: '12', label: 'bicep', description: 'circumference' },
        { value: '11', label: 'cuff', description: 'circumference' },
    ]

    return (
        <div className="min-h-screen bg-white">
            {/* Desktop Layout */}
            <div className="hidden lg:grid max-w-[1700px] mx-auto grid-cols-11 font-inter">
                {/* Left Margin - 1 column */}
                <div className="col-span-1"/>

                {/* Product Info - 4 columns */}
                <div className="col-span-4 pt-4 pr-[8vw]">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-12">
                        <h1 className="text-[10px]">{product.name}</h1>
                        {designerLabel && (
                            <p className={`text-[11px] tracking-tight font-bold transition-opacity ${showSizing ? 'opacity-50' : 'opacity-100'}`}>
                                {designerLabel}
                            </p>
                        )}
                    </div>

                    {/* Manufacturing Info */}
                    <div className={`mb-8 transition-opacity ${showSizing ? 'opacity-50' : 'opacity-100'}`}>
                        <p className="text-[8pt] tracking-wider font-inter font-bold">Manufactured in the USA for Grand-Cord</p>
                    </div>

                    {/* Materials */}
                    <div className={`mb-20 flex gap-8 font-inter transition-opacity ${showSizing ? 'opacity-50' : 'opacity-100'}`}>
                        {product.material && (
                            <p className="text-xs">Body {product.material}</p>
                        )}
                        {product.color && (
                            <p className="text-xs">Lining {product.color}</p>
                        )}
                    </div>

                    {/* Description */}
                    {product.description && (
                        <div className="mb-20 w-full font-inter min-h-[200px]">
                            <p className="text-xs leading-[1.8] tracking-[1.3] text-justify">{product.description}</p>
                        </div>
                    )}

                    {/* Size Selector */}
                    <div className="mb-8 font-inter">
                        {/* Numbers and Price Row */}
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex gap-2">
                                {availableSizes.map((size, index) => (
                                    <button
                                        key={size.id}
                                        onClick={() => setSelectedSize(size.size)}
                                        className={`text-sm transition-opacity ${
                                            selectedSize === size.size
                                                ? 'opacity-100 font-bold'
                                                : 'opacity-50 hover:opacity-75'
                                        }`}
                                    >
                                        {index + 1}
                                    </button>
                                ))}
                            </div>
                            <p className="text-sm">
                                $ {product.price.toFixed(2).replace('.', '. ')}
                            </p>
                        </div>

                        {/* Sizing Dropdown and Add Row */}
                        <div className="flex items-start justify-between">
                            <button
                                onClick={() => setShowSizing(!showSizing)}
                                className="flex items-center gap-1 hover:opacity-70"
                            >
                                <span className="text-[8pt]">Sizing</span>
                                <span className="text-[5pt]">{showSizing ? '▲' : '▼'}</span>
                            </button>
                            <button
                                onClick={handleAdd}
                                disabled={!selectedSize}
                                className="text-xs hover:opacity-70 disabled:opacity-30 transition-opacity"
                            >
                                {buttonState === 'added' ? 'Added' : 'Add'}
                            </button>
                        </div>

                        {/* Sizing Chart Dropdown */}
                        {showSizing && (
                            <motion.div
                                initial={{opacity: 0, height: 0}}
                                animate={{opacity: 1, height: 'auto'}}
                                exit={{opacity: 0, height: 0}}
                                className="mt-8 text-xs"
                            >
                                <div className="space-y-2">
                                    {measurements.map((measurement, index) => (
                                        <div key={index} className="grid grid-cols-[50px_60px_1fr_2fr] gap-x-4 items-baseline">
                                            <span className="font-bold text-sm">{measurement.value}</span>
                                            <span className="text-[8pt] text-neutral-500">in/cm</span>
                                            <span className="font-bold">{measurement.label}</span>
                                            <span className="text-neutral-600 text-right">{measurement.description}</span>
                                        </div>
                                    ))}
                                </div>
                            </motion.div>
                        )}
                    </div>
                </div>

                {/* Scrollable Images - 5 columns */}
                <div className="col-span-5 overflow-y-scroll h-screen snap-y snap-mandatory scroll-smooth">
                    {imageArray.map((img, index) => (
                        <div key={index} className="w-full snap-start snap-always">
                            {img ? (
                                <div className="relative w-full aspect-[3/4]">
                                    <Image
                                        src={img}
                                        alt={`${product.name} ${index + 1}`}
                                        fill
                                        className="object-cover"
                                        priority={index === 0}
                                    />
                                </div>
                            ) : (
                                <div
                                    className="w-full aspect-[3/4] flex items-center justify-center bg-neutral-100 text-neutral-400">
                                    No Image
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {/* Right Margin - 1 column */}
                <div className="col-span-1"/>
            </div>

            {/* Mobile Layout */}
            <div className="lg:hidden scale-90 font-inter">
                {/* Product Info */}
                <div className="px-12 pt-20 ">
                    {/* Header */}
                    <div className="flex items-start  justify-between mb-20">
                        <h1 className={`text-[10px] transition-opacity ${showSizing ? 'opacity-50' : 'opacity-100'}`}>
                            {product.name}
                        </h1>
                        <div className={`text-right  transition-opacity ${showSizing ? 'opacity-50' : 'opacity-100'}`}>
                            {designerLabel && (
                                <>
                                    <p className="text-[11px] font-semibold tracking-tight whitespace-nowrap font ">{designerLabel}</p>
                                </>
                            )}
                        </div>
                    </div>

                    <div
                        className={`mb-2 flex gap-8  font-semibold text-[9pt] tracking-[1.1] transition-opacity ${showSizing ? 'opacity-50' : 'opacity-100'}`}>
                        {product.material && (
                            <p className="">Body {product.material}</p>
                        )}
                        {product.color && (
                            <p className="">Lining {product.color}</p>
                        )}
                    </div>

                    {/* Content area with conditional background */}
                    <div className={`transition-colors   ${showSizing ? 'bg-[#FCFDF0] -mx-12 px-12 py-4' : ''}`}>


                        {/* Manufacturing Info - only show when sizing is closed */}
                        {!showSizing && (
                            <div className="pb-8">
                                <p className="text-[9pt] opacity-70 pb-20 font-semibold text-[9pt] tracking-[1.1] ">Manufactured in the USA</p>
                            </div>
                        )}

                        {/* Sizing Chart - replaces description area */}
                        {showSizing ? (
                            <motion.div

                                className="mb-6"
                            >
                                <div className="space-y-2 pt-30 pb-20  px-8">
                                    {measurements.map((measurement, index) => (
                                        <div key={index}
                                             className="grid  grid-cols-[40px_50px_1fr_2fr] gap-x-2 items-baseline text-xs">
                                            <span className="font-bold">{measurement.value}</span>
                                            <span className="text-[8pt] text-neutral-500">in/cm</span>
                                            <span className="font-bold">{measurement.label}</span>
                                            <span className="text-neutral-600 text ">{measurement.description}</span>
                                        </div>
                                    ))}
                                </div>
                            </motion.div>
                        ) : (
                            /* Description - only show when sizing is closed */
                            product.description && (
                                <div className="mb-32 font-light">
                                    <p className="text-[10pt] tracking-[1.2] text-justify leading-[1.8]">{product.description}</p>
                                </div>
                            )
                        )}


                        {/* Size Numbers */}
                        <div className="flex gap-3 mb-8">
                            {availableSizes.map((size, index) => (
                                <button
                                    key={size.id}
                                    onClick={() => setSelectedSize(size.size)}
                                    className={`text-sm transition-opacity ${
                                        selectedSize === size.size
                                            ? 'opacity-100 font-bold'
                                            : 'opacity-50 hover:opacity-75'
                                    }`}
                                >
                                    {index + 1}
                                </button>
                            ))}
                        </div>

                        {/* Sizing and Price Row */}
                        <div className="flex items-start justify-between mb-4">
                            <button
                                onClick={() => setShowSizing(!showSizing)}
                                className="flex items-center gap-4 hover:opacity-70"
                            >
                                <span className="tracking-[1.1] text-[9pt]">Sizing</span>
                                <span className="  text-[6pt]">{showSizing ? '▲' : '▼'}</span>
                            </button>
                            <p className="text-sm">
                                $ {product.price.toFixed(2).replace('.', '. ')}
                            </p>
                        </div>

                        {/* Add Button */}
                        <div className="flex mb-8 justify-end">
                            <button
                                onClick={handleAdd}
                                disabled={!selectedSize}
                                className="text-xs hover:opacity-70 disabled:opacity-30 transition-opacity"
                            >
                                {buttonState === 'added' ? 'Added' : 'Add'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Mobile Images */}
                <div className=" -mx-12  my-4 scale-110 h-[60vh] snap-y snap-mandatory scroll-smooth">
                    {imageArray.map((img, index) => (
                        <div key={index} className="w-full snap-start snap-always">
                            {img ? (
                                <div className="relative w-full aspect-[3/4]">
                                    <Image
                                        src={img}
                                        alt={`${product.name} ${index + 1}`}
                                        fill
                                        className="object-cover"
                                        priority={index === 0}
                                    />
                                </div>
                            ) : (
                                <div className="w-full aspect-[3/4] flex items-center justify-center bg-neutral-100 text-neutral-400">
                                    No Image
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
