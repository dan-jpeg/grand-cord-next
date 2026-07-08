'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import {
    addAttributeToProduct,
    addCategoryToProduct,
    removeAttributeFromProduct,
    removeCategoryFromProduct,
    reorderAttribute,
    setMeasurement,
} from '@/app/admin/products/[id]/sizing/actions'

type ProductLite = { id: string; name: string; slug: string }
type SizeRow = {
    id: string
    size: string
    measurements: Record<string, string>
}
type AttributeLite = {
    id: string
    title: string
    description: string | null
    category: string
}
type ProductAttribute = AttributeLite & { sortOrder: number }

export function ProductSizingView({
    product,
    sizes,
    productAttributes,
    allAttributes,
}: {
    product: ProductLite
    sizes: SizeRow[]
    productAttributes: ProductAttribute[]
    allAttributes: AttributeLite[]
}) {
    const [pending, startTransition] = useTransition()

    const includedIds = useMemo(
        () => new Set(productAttributes.map((a) => a.id)),
        [productAttributes],
    )

    const allByCategory = useMemo(() => {
        const map = new Map<string, AttributeLite[]>()
        for (const a of allAttributes) {
            const list = map.get(a.category) ?? []
            list.push(a)
            map.set(a.category, list)
        }
        return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b))
    }, [allAttributes])

    const addOne = (attrId: string) => {
        startTransition(async () => {
            await addAttributeToProduct(product.id, attrId)
        })
    }
    const addCategory = (cat: string) => {
        startTransition(async () => {
            await addCategoryToProduct(product.id, cat)
        })
    }
    const removeCategory = (cat: string, includedCount: number) => {
        if (
            includedCount > 0 &&
            !confirm(
                `Remove all ${includedCount} attribute(s) in "${cat}"? Their values across sizes will be cleared.`,
            )
        ) {
            return
        }
        startTransition(async () => {
            await removeCategoryFromProduct(product.id, cat)
        })
    }
    const removeOne = (attrId: string) => {
        if (!confirm('Remove this attribute? Its values across sizes will be cleared.')) return
        startTransition(async () => {
            await removeAttributeFromProduct(product.id, attrId)
        })
    }
    const toggleOne = (attrId: string, checked: boolean) => {
        if (checked) {
            addOne(attrId)
        } else {
            removeOne(attrId)
        }
    }
    const move = (attrId: string, dir: 'up' | 'down') => {
        startTransition(async () => {
            await reorderAttribute(product.id, attrId, dir)
        })
    }

    return (
        <div className="max-w-[1200px] mx-auto font-inter">
            <div className="flex items-center justify-between mb-2">
                <h1 className="text-[14px] font-bold">{product.name}</h1>
                <Link
                    href={`/admin/products/${product.id}/edit`}
                    className="text-[10pt] underline underline-offset-2"
                >
                    ← back to product
                </Link>
            </div>
            <p className="text-[10pt] text-neutral-500 mb-10">Sizing chart</p>

            {/* Pick attributes */}
            <section className="mb-12">
                <p className="text-[9pt] font-bold uppercase tracking-[0.05em] text-neutral-500 mb-3">
                    Attributes
                </p>

                {productAttributes.length === 0 ? (
                    <p className="text-[10pt] text-neutral-400 mb-4">
                        None yet. Pick from the catalog below.
                    </p>
                ) : (
                    <ul className="flex flex-col border-y border-neutral-200 divide-y divide-neutral-200 mb-6">
                        {productAttributes.map((a, i) => (
                            <li
                                key={a.id}
                                className="flex items-center justify-between py-2 text-[10pt]"
                            >
                                <div>
                                    <span className="font-bold">{a.title}</span>
                                    {a.description && (
                                        <span className="text-neutral-500 ml-3">
                                            {a.description}
                                        </span>
                                    )}
                                    <span className="text-[9pt] text-neutral-400 ml-3">
                                        ({a.category})
                                    </span>
                                </div>
                                <div className="flex items-center gap-3 text-[9pt]">
                                    <button
                                        type="button"
                                        disabled={pending || i === 0}
                                        onClick={() => move(a.id, 'up')}
                                        className="disabled:opacity-30"
                                        aria-label="Move up"
                                    >
                                        ▲
                                    </button>
                                    <button
                                        type="button"
                                        disabled={pending || i === productAttributes.length - 1}
                                        onClick={() => move(a.id, 'down')}
                                        className="disabled:opacity-30"
                                        aria-label="Move down"
                                    >
                                        ▼
                                    </button>
                                    <button
                                        type="button"
                                        disabled={pending}
                                        onClick={() => removeOne(a.id)}
                                        className="text-neutral-500 hover:text-red-600 underline underline-offset-2"
                                    >
                                        remove
                                    </button>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}

                {/* Catalog tree — toggle attributes individually or whole categories */}
                {allByCategory.length > 0 && (
                    <div className="flex flex-col gap-5">
                        <p className="text-[9pt] text-neutral-500">
                            Toggle individual attributes, or use the group checkbox to
                            add/remove a whole category at once:
                        </p>
                        {allByCategory.map(([cat, items]) => {
                            const includedInCat = items.filter((a) => includedIds.has(a.id))
                            const allIncluded = includedInCat.length === items.length
                            const noneIncluded = includedInCat.length === 0
                            const onGroupToggle = () => {
                                if (allIncluded) {
                                    removeCategory(cat, includedInCat.length)
                                } else {
                                    addCategory(cat)
                                }
                            }
                            return (
                                <div key={cat}>
                                    <div className="flex items-center gap-2 mb-2">
                                        <TriStateCheckbox
                                            checked={allIncluded}
                                            indeterminate={!allIncluded && !noneIncluded}
                                            disabled={pending}
                                            onChange={onGroupToggle}
                                            ariaLabel={`Toggle all ${cat}`}
                                        />
                                        <button
                                            type="button"
                                            disabled={pending}
                                            onClick={onGroupToggle}
                                            className="text-[9pt] font-bold uppercase tracking-[0.05em] text-neutral-500"
                                        >
                                            {cat}
                                            <span className="ml-2 font-normal text-neutral-400">
                                                ({includedInCat.length}/{items.length})
                                            </span>
                                        </button>
                                    </div>
                                    <div className="flex flex-col gap-1 pl-6">
                                        {items.map((a) => {
                                            const checked = includedIds.has(a.id)
                                            return (
                                                <label
                                                    key={a.id}
                                                    className="flex items-baseline gap-2 text-[10pt] cursor-pointer select-none"
                                                    title={a.description ?? undefined}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={checked}
                                                        disabled={pending}
                                                        onChange={(e) =>
                                                            toggleOne(a.id, e.target.checked)
                                                        }
                                                        className="cursor-pointer"
                                                    />
                                                    <span>{a.title}</span>
                                                    {a.description && (
                                                        <span className="text-neutral-400 text-[9pt]">
                                                            {a.description}
                                                        </span>
                                                    )}
                                                </label>
                                            )
                                        })}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </section>

            {/* Values grid */}
            <section>
                <div className="flex items-baseline justify-between mb-3">
                    <p className="text-[9pt] font-bold uppercase tracking-[0.05em] text-neutral-500">
                        Measurements <span className="text-neutral-400">(cm)</span>
                    </p>
                    <p className="text-[9pt] text-neutral-500">
                        Enter values in centimeters. The storefront converts to inches
                        for display.
                    </p>
                </div>

                {sizes.length === 0 ? (
                    <p className="text-[10pt] text-neutral-400">
                        This product has no sizes yet. Add sizes on the product page
                        before entering measurements.
                    </p>
                ) : productAttributes.length === 0 ? (
                    <p className="text-[10pt] text-neutral-400">
                        Pick some attributes above to start entering measurements.
                    </p>
                ) : (
                    <MeasurementGrid
                        productId={product.id}
                        sizes={sizes}
                        attributes={productAttributes}
                    />
                )}
            </section>
        </div>
    )
}

function TriStateCheckbox({
    checked,
    indeterminate,
    disabled,
    onChange,
    ariaLabel,
}: {
    checked: boolean
    indeterminate: boolean
    disabled?: boolean
    onChange: () => void
    ariaLabel: string
}) {
    const ref = useRef<HTMLInputElement>(null)
    useEffect(() => {
        if (ref.current) ref.current.indeterminate = indeterminate
    }, [indeterminate])
    return (
        <input
            ref={ref}
            type="checkbox"
            checked={checked}
            disabled={disabled}
            onChange={onChange}
            aria-label={ariaLabel}
            className="cursor-pointer"
        />
    )
}

function MeasurementGrid({
    productId,
    sizes,
    attributes,
}: {
    productId: string
    sizes: SizeRow[]
    attributes: ProductAttribute[]
}) {
    return (
        <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-[10pt]">
                <thead>
                    <tr className="border-b border-neutral-200">
                        <th className="text-left font-bold py-2 pr-4 w-[80px]">
                            Size
                        </th>
                        {attributes.map((a) => (
                            <th
                                key={a.id}
                                className="text-left font-bold py-2 px-3"
                                title={a.description ?? undefined}
                            >
                                {a.title}{' '}
                                <span className="font-normal text-neutral-400 text-[8pt]">
                                    cm
                                </span>
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {sizes.map((s) => (
                        <tr key={s.id} className="border-b border-neutral-100">
                            <td className="py-2 pr-4 font-bold">{s.size}</td>
                            {attributes.map((a) => (
                                <td key={a.id} className="py-1 px-3">
                                    <MeasurementCell
                                        productId={productId}
                                        productSizeId={s.id}
                                        attributeId={a.id}
                                        initialValue={s.measurements[a.id] ?? ''}
                                    />
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}

// Storage is inches; admin form is cm. These convert at the form boundary.
// Inches are rounded to nearest 1/4 so the round-trip stays clean even if the
// admin re-edits a previously-saved cell.
function inchesToCm(inches: string): string {
    const n = parseFloat(inches)
    if (!Number.isFinite(n)) return ''
    return Math.round(n * 2.54).toString()
}

function cmToInches(cm: string): string {
    const n = parseFloat(cm)
    if (!Number.isFinite(n)) return ''
    return (Math.round((n / 2.54) * 4) / 4).toString()
}

function MeasurementCell({
    productId,
    productSizeId,
    attributeId,
    initialValue,
}: {
    productId: string
    productSizeId: string
    attributeId: string
    /** Stored inches value; UI displays it as cm. */
    initialValue: string
}) {
    const initialCm = inchesToCm(initialValue)
    const [value, setValue] = useState(initialCm)
    const [savedCm, setSavedCm] = useState(initialCm)
    const [pending, startTransition] = useTransition()

    const commit = () => {
        if (value === savedCm) return
        const trimmed = value.trim()
        const inchesToSave = trimmed ? cmToInches(trimmed) : ''
        startTransition(async () => {
            await setMeasurement(productId, productSizeId, attributeId, inchesToSave)
            setSavedCm(trimmed)
        })
    }

    return (
        <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
                if (e.key === 'Enter') {
                    e.preventDefault()
                    ;(e.target as HTMLInputElement).blur()
                }
            }}
            disabled={pending}
            placeholder="cm"
            inputMode="decimal"
            className="w-[80px] border-b border-neutral-200 focus:border-black outline-none px-1 py-1 text-[10pt] bg-transparent"
        />
    )
}
