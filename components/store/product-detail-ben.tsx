'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useCart } from '@/contexts/cart-context'
import { CartIndicator } from '@/components/store/cart-indicator'
import type { Product, ProductSize } from '@prisma/client'
import { motion } from 'framer-motion'
import { formatDesignerNames } from '@/lib/designers'

type ImageData = {
    url: string
    isMobilePrimary: boolean
    isDesktopPrimary: boolean
    showOnPdp?: boolean
}

type SizeMeasurement = { sizingAttributeId: string; value: string }
type SizeWithMeasurements = ProductSize & { measurements: SizeMeasurement[] }
type ProductSizingAttr = {
    sortOrder: number
    sizingAttribute: { id: string; title: string; description: string | null }
}

type ProductWithSizes = Product & {
    sizes: SizeWithMeasurements[]
    sizingAttributes: ProductSizingAttr[]
}

export function ProductDetailBen({ product }: { product: ProductWithSizes }) {
    const { addItem } = useCart()
    const [showSizing, setShowSizing] = useState(false)
    const [buttonState, setButtonState] = useState<'idle' | 'added'>('idle')
    const [unit, setUnit] = useState<'in' | 'cm'>('in')

    const availableSizes = product.sizes
        .filter(s => s.available > 0)
        .sort((a, b) => {
            const order = ['1', '2', '3', '4', '5', 'o/s']
            return order.indexOf(a.size) - order.indexOf(b.size)
        })

    const [selectedSize, setSelectedSize] = useState<string>(
        availableSizes.length === 1 ? availableSizes[0].size : ''
    )

    function openSizing() {
        if (!selectedSize && availableSizes.length > 0) {
            setSelectedSize(availableSizes[0].size)
        }
        setShowSizing(true)
    }

    const displayValue = (inches: string) => {
        if (!inches) return '—'
        if (unit === 'in') return inches
        const n = parseFloat(inches)
        return Number.isFinite(n) ? Math.round(n * 2.54).toString() : inches
    }
    const toggleUnit = () => setUnit(u => (u === 'in' ? 'cm' : 'in'))

    const images = product.images as unknown as ImageData[]
    const designerLabel = formatDesignerNames(product.designerNames)
    const displayImage = images.find(img => img.isDesktopPrimary)?.url || images[0]?.url

    // Gallery images, hero image first, filtered to those marked visible on the PDP.
    const galleryImages = images.filter(img => img.showOnPdp !== false)
    const imageArray = [
        ...galleryImages.filter(img => img.url === displayImage),
        ...galleryImages.filter(img => img.url !== displayImage),
    ].map(img => img.url)

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
    // Per-size measurements derived from the DB. Each row is one attribute
    // configured for this product; value comes from the currently selected
    // size's measurement for that attribute (or "—" when not yet entered).
    const activeSize = product.sizes.find((s) => s.size === selectedSize)
        ?? availableSizes[0]
        ?? product.sizes[0]
    const valueByAttr = new Map(
        (activeSize?.measurements ?? []).map((m) => [m.sizingAttributeId, m.value]),
    )
    const measurements = product.sizingAttributes.map((pa) => ({
        value: valueByAttr.get(pa.sizingAttribute.id) ?? '',
        label: pa.sizingAttribute.title.toLowerCase(),
        description: pa.sizingAttribute.description ?? '',
    }))
    const hasSizingChart = measurements.length > 0

    return (
        <div className="min-h-screen bg-white lg:h-screen lg:overflow-hidden">
            {/* Desktop cart indicator — top-right, replaces the sticky nav that PDPs opt out of. */}
            <CartIndicator className="hidden lg:flex fixed top-4 right-[2vw] z-30" />

            {/* Desktop Layout */}
            <div className="hidden lg:grid h-full max-w-[1700px] mx-auto grid-cols-11 font-inter">
                {/* Product Info - 5 columns. Padding is per-section so the sizing bg can fill full width. */}
                <div className="col-span-5 pt-4">
                    {/* Header — Catalog link on the left (replaces the global sticky nav on PDPs),
                        product name + designer on the right. */}
                    <div className="flex items-baseline justify-between mb-12 pl-[20%] pr-[8vw]">
                        <div className="flex items-baseline gap-8">
                            <Link href="/#catalog-desktop" scroll={false} className="text-[12px] hover:underline">
                                Catalog
                            </Link>
                            <h1 className="text-[12px]">{product.name}</h1>
                        </div>
                        {designerLabel && (
                            <p className={`text-[11px] tracking-tight font-medium transition-opacity ${showSizing ? 'opacity-50' : 'opacity-100'}`}>
                                {designerLabel}
                            </p>
                        )}
                    </div>

                    {/* Manufacturing Info */}
                    <div className={`mb-8 pt-32 pl-[20%] pr-[8vw] transition-opacity ${showSizing ? 'opacity-50' : 'opacity-80'}`}>
                        <p className="text-[8pt] tracking-wide font-inter font-bold">Manufactured in the USA for Grand-Cord</p>
                    </div>

                    {/* Materials */}
                    <div className={`mb-20 flex gap-8 pl-[20%] pr-[8vw] font-inter transition-opacity ${showSizing ? 'opacity-50' : 'opacity-80'}`}>
                        {product.attribute1 && (
                            <p className="text-[8pt] capitalize">{product.attribute1}</p>
                        )}
                        {product.attribute2 && (
                            <p className="text-[8pt]">{product.attribute2}</p>
                        )}
                    </div>

                    {/* Description */}
                    {product.description && (
                        <div className={`mb-20 w-full pl-[20%] pr-[8vw] font-inter min-h-[200px] transition-opacity ${showSizing ? 'opacity-50' : 'opacity-80'}`}>
                            <p className="text-[7.5pt] leading-[1.8] tracking-[1.0] text-justify">{product.description}</p>
                        </div>
                    )}

                    {/* Size Selector — wrapper gets yellow bg when open. Negative margins extend the yellow up/left while matching padding keeps content in place. */}
                    <div className={`font-inter ${showSizing ? '-mt-[160px] pt-[160px] -ml-[100vw] pl-[100vw] pb-[100vh] bg-[#FCFDF0]' : 'mb-8'}`}>
                        <div className="pl-[20%] pr-[8vw]">
                            {/* Numbers and Price Row */}
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex gap-3">
                                    {availableSizes.map((size, index) => (
                                        <button
                                            key={size.id}
                                            onClick={() => setSelectedSize(size.size)}
                                            className={`text-[9pt] transition-opacity ${
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
                            <div className="flex items-start justify-between -mr-[8vw]">
                                {hasSizingChart ? (
                                    <button
                                        onClick={() => showSizing ? setShowSizing(false) : openSizing()}
                                        className="flex items-center gap-4 hover:opacity-70"
                                    >
                                        <span className="text-[8.5pt]">Sizing</span>
                                        <span className="text-[5pt]">{showSizing ? '▲' : '▼'}</span>
                                    </button>
                                ) : (
                                    <span />
                                )}
                                <button
                                    onClick={handleAdd}
                                    disabled={!selectedSize}
                                    className="text-xs w-1/2 py-2 -my-2 pr-[8vw] text-right disabled:opacity-30 transition-colors enabled:hover:bg-[#FCFDF0]"
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
                                            <div key={index} className="grid grid-cols-[40px_50px_80px_16px_1fr] gap-x-4 items-baseline">
                                                <span className="font-bold text-sm">{displayValue(measurement.value)}</span>
                                                <button onClick={toggleUnit} className="text-[8pt] text-neutral-500 text-left">
                                                    <span className={unit === 'in' ? '' : 'opacity-30'}>in</span>
                                                    <span className="opacity-30">/</span>
                                                    <span className={unit === 'cm' ? '' : 'opacity-30'}>cm</span>
                                                </button>
                                                <span className="font-bold">{measurement.label}</span>
                                                <span className="text-neutral-600">:</span>
                                                <span className="text-neutral-600">{measurement.description}</span>
                                            </div>
                                        ))}
                                    </div>
                                </motion.div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Scrollable Images - 5 columns */}
                <div className="col-span-5 overflow-y-scroll h-full snap-y snap-mandatory scroll-smooth scrollbar-hide">
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

            {/* Mobile Layout — pb here (not a margin on the images) so the gap below
                the image column can't margin-collapse out of the bg-white container. */}
            <div className="lg:hidden scale-90 font-inter pb-[140px]">
                {/* Product Info */}
                <div className="px-6 pt-12 ">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-12">
                        <h1 className={`text-[10px] transition-opacity ${showSizing ? 'opacity-50' : 'opacity-100'}`}>
                            {product.name}
                        </h1>
                        {product.designerNames && product.designerNames.length > 0 && (
                            <div
                                className={`flex gap-4 text-right transition-opacity ${showSizing ? 'opacity-50' : 'opacity-100'}`}>
                                {product.designerNames.map((name) => (
                                    <p key={name} className="text-[10px] tracking-tight">{name}</p>
                                ))}
                            </div>
                        )}
                    </div>

                    <div
                        className={`mb-2 flex gap-8  font-semibold text-[9pt] tracking-[1.1] transition-opacity ${showSizing ? 'opacity-50' : 'opacity-100'}`}>
                        {product.attribute1 && (
                            <p className="">{product.attribute1}</p>
                        )}
                        {product.attribute2 && (
                            <p className="">{product.attribute2}</p>
                        )}
                    </div>

                    {/* Content area with conditional background */}
                    <div
                        className={`transition-colors   ${showSizing ? 'bg-[#FCFDF0] -mx-[100vw] px-[100vw] pt-4 pb-24' : ''}`}>


                        {/* Manufacturing Info - only show when sizing is closed */}
                        {!showSizing && (
                            <div className="pb-8">
                                <p className="text-[9pt] opacity-70 pb-20 font-semibold text-[9pt] tracking-[1.1] ">Manufactured
                                    in the USA</p>
                            </div>
                        )}

                        {/* Sizing Chart - replaces description area */}
                        {showSizing ? (
                            <motion.div

                                className="mb-6"
                            >
                                <div className="space-y-2 pt-30 pb-20  px-2">
                                    {measurements.map((measurement, index) => (
                                        <div key={index}
                                             className="grid  grid-cols-[28px_40px_60px_1fr] gap-x-2 items-baseline text-[8pt] whitespace-nowrap">
                                            <span className="font-bold">{displayValue(measurement.value)}</span>
                                            <button onClick={toggleUnit}
                                                    className="text-[7pt] text-neutral-500 text-left">
                                                <span className={unit === 'in' ? '' : 'opacity-30'}>in</span>
                                                <span className="opacity-30">/</span>
                                                <span className={unit === 'cm' ? '' : 'opacity-30'}>cm</span>
                                            </button>
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
                                    <p className="text-[10pt] tracking-[1.1] text-justify leading-[1.8]">{product.description}</p>
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
                            {hasSizingChart ? (
                                <button
                                    onClick={() => showSizing ? setShowSizing(false) : openSizing()}
                                    className="flex items-center gap-4 hover:opacity-70"
                                >
                                    <span className="tracking-[1.1] text-[9pt]">Sizing</span>
                                    <span className="  text-[6pt]">{showSizing ? '▲' : '▼'}</span>
                                </button>
                            ) : (
                                <span/>
                            )}
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
                <div className=" -mx-6  scale-100 h-[59vh] snap-y snap-mandatory scroll-smooth">
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
