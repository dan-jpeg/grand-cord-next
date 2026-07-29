'use client'

import Link from 'next/link'
import { useMemo, useState, useTransition } from 'react'
import { AdminNav } from '@/components/admin/admin-nav'
import {
    addAttributeToProduct,
    addCategoryToProduct,
    removeAttributeFromProduct,
    removeCategoryFromProduct,
    reorderAttribute,
    setMeasurement,
} from '@/app/admin/products/[id]/sizing/actions'

type ProductLite = { id: string; name: string }
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

type SizingTab = 'attributes' | 'measurements'

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
    const [tab, setTab] = useState<SizingTab>('attributes')
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

    const toggleOne = (attrId: string, checked: boolean) => {
        if (checked) {
            startTransition(async () => {
                await addAttributeToProduct(product.id, attrId)
            })
        } else {
            if (!confirm('Remove this attribute? Its values across sizes will be cleared.')) return
            startTransition(async () => {
                await removeAttributeFromProduct(product.id, attrId)
            })
        }
    }

    const removeOne = (attrId: string) => {
        if (!confirm('Remove this attribute? Its values across sizes will be cleared.')) return
        startTransition(async () => {
            await removeAttributeFromProduct(product.id, attrId)
        })
    }

    const move = (attrId: string, dir: 'up' | 'down') => {
        startTransition(async () => {
            await reorderAttribute(product.id, attrId, dir)
        })
    }

    const toggleCategory = (cat: string, items: AttributeLite[]) => {
        const includedInCat = items.filter((a) => includedIds.has(a.id))
        if (includedInCat.length === items.length) {
            if (
                includedInCat.length > 0 &&
                !confirm(`Remove all ${includedInCat.length} attribute(s) in "${cat}"? Their values across sizes will be cleared.`)
            ) {
                return
            }
            startTransition(async () => {
                await removeCategoryFromProduct(product.id, cat)
            })
        } else {
            startTransition(async () => {
                await addCategoryToProduct(product.id, cat)
            })
        }
    }

    const backHref = `/admin/products/${product.id}/edit?tab=listing`

    return (
        <div className="min-h-[100dvh] bg-white text-black font-inter">
            <AdminNav active="inventory" mobileLabel="Inventory" mobileBackHref={backHref} />

            {/* Product name badge, top-right — same yellow as the store-side sizing highlight. Links back to the product listing editor. */}
            <Link
                href={backHref}
                className="fixed top-[7px] right-[11px] z-[400] bg-[#FCFDF0] px-2 h-[13px] flex items-center"
            >
                <span className="text-[12px] font-bold leading-none">{product.name}</span>
            </Link>

            <div className="max-w-[520px] mx-auto px-4 pt-[44px] pb-16">
                <div className="flex items-baseline justify-between mb-8">
                    <h1 className="text-[12px] font-bold">{product.name} Size Guide</h1>
                    <div className="flex items-center gap-4 text-[12px]">
                        <button
                            type="button"
                            onClick={() => setTab('attributes')}
                            className={
                                tab === 'attributes'
                                    ? 'underline underline-offset-[3px]'
                                    : 'opacity-20 hover:opacity-40'
                            }
                        >
                            Attributes
                        </button>
                        <button
                            type="button"
                            onClick={() => setTab('measurements')}
                            className={
                                tab === 'measurements'
                                    ? 'underline underline-offset-[3px]'
                                    : 'opacity-20 hover:opacity-40'
                            }
                        >
                            Measurements
                        </button>
                    </div>
                </div>

                {tab === 'attributes' ? (
                    <AttributesTab
                        productAttributes={productAttributes}
                        allByCategory={allByCategory}
                        includedIds={includedIds}
                        pending={pending}
                        move={move}
                        removeOne={removeOne}
                        toggleOne={toggleOne}
                        toggleCategory={toggleCategory}
                    />
                ) : (
                    <MeasurementsTab productId={product.id} sizes={sizes} attributes={productAttributes} />
                )}
            </div>
        </div>
    )
}

function AttributesTab({
    productAttributes,
    allByCategory,
    includedIds,
    pending,
    move,
    removeOne,
    toggleOne,
    toggleCategory,
}: {
    productAttributes: ProductAttribute[]
    allByCategory: [string, AttributeLite[]][]
    includedIds: Set<string>
    pending: boolean
    move: (attrId: string, dir: 'up' | 'down') => void
    removeOne: (attrId: string) => void
    toggleOne: (attrId: string, checked: boolean) => void
    toggleCategory: (cat: string, items: AttributeLite[]) => void
}) {
    return (
        <div className="space-y-10">
            <section>
                <p className="text-[12px] font-bold mb-3">Shown in catalog:</p>
                {productAttributes.length === 0 ? (
                    <p className="text-[12px] opacity-40">None yet — add from the list below.</p>
                ) : (
                    <div className="border-y border-black">
                        {productAttributes.map((a, i) => (
                            <div
                                key={a.id}
                                className="flex items-center gap-3 py-2 border-b border-black last:border-b-0 text-[12px]"
                            >
                                <span className="font-bold w-[64px] shrink-0">{a.title}</span>
                                <span className="flex-1 opacity-50 truncate">{a.description}</span>
                                <div className="flex items-center gap-3 shrink-0 text-[10px]">
                                    <button
                                        type="button"
                                        disabled={pending || i === 0}
                                        onClick={() => move(a.id, 'up')}
                                        className="disabled:opacity-20"
                                        aria-label="Move up"
                                    >
                                        ^
                                    </button>
                                    <button
                                        type="button"
                                        disabled={pending || i === productAttributes.length - 1}
                                        onClick={() => move(a.id, 'down')}
                                        className="disabled:opacity-20"
                                        aria-label="Move down"
                                    >
                                        v
                                    </button>
                                    <button
                                        type="button"
                                        disabled={pending}
                                        onClick={() => removeOne(a.id)}
                                        className="hover:opacity-50 disabled:opacity-20"
                                        aria-label="Remove"
                                    >
                                        x
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            <section className="space-y-8">
                {allByCategory.map(([cat, items]) => {
                    const includedInCat = items.filter((a) => includedIds.has(a.id))
                    const allIncluded = includedInCat.length === items.length
                    const noneIncluded = includedInCat.length === 0
                    return (
                    <div key={cat}>
                        <button
                            type="button"
                            disabled={pending}
                            onClick={() => toggleCategory(cat, items)}
                            className="flex items-center gap-2.5 mb-3 disabled:opacity-40"
                        >
                            <span
                                className={`inline-block w-[7px] h-[7px] rounded-full shrink-0 ${
                                    allIncluded ? 'bg-black' : noneIncluded ? 'bg-black/20' : 'bg-black/50'
                                }`}
                            />
                            <span className="text-[12px] font-bold uppercase tracking-[0.05em]">{cat}</span>
                            <span className="text-[10px] opacity-40">
                                ({includedInCat.length}/{items.length})
                            </span>
                        </button>
                        <div className="space-y-2.5 pl-[17px]">
                            {items.map((a) => {
                                const checked = includedIds.has(a.id)
                                return (
                                    <button
                                        key={a.id}
                                        type="button"
                                        disabled={pending}
                                        onClick={() => toggleOne(a.id, !checked)}
                                        className="flex items-center gap-2.5 text-[12px] text-left w-full disabled:opacity-40"
                                    >
                                        <span
                                            className={`inline-block w-[7px] h-[7px] rounded-full shrink-0 ${
                                                checked ? 'bg-black' : 'bg-black/20'
                                            }`}
                                        />
                                        <span className={`font-bold shrink-0 w-[64px] ${checked ? '' : 'opacity-40'}`}>
                                            {a.title}
                                        </span>
                                        {a.description && (
                                            <span className={`opacity-50 truncate ${checked ? '' : 'opacity-30'}`}>
                                                {a.description}
                                            </span>
                                        )}
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                    )
                })}
            </section>
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

// No design exists for this tab yet — plain table until one lands.
function MeasurementsTab({
    productId,
    sizes,
    attributes,
}: {
    productId: string
    sizes: SizeRow[]
    attributes: ProductAttribute[]
}) {
    if (sizes.length === 0) {
        return <p className="text-[12px] opacity-40">This product has no sizes yet.</p>
    }
    if (attributes.length === 0) {
        return <p className="text-[12px] opacity-40">Pick some attributes above to start entering measurements.</p>
    }

    return (
        <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-[12px]">
                <thead>
                    <tr className="border-b border-black">
                        <th className="text-left font-bold py-2 pr-4 w-[60px]">Size</th>
                        {attributes.map((a) => (
                            <th key={a.id} className="text-left font-bold py-2 px-3" title={a.description ?? undefined}>
                                {a.title} <span className="font-normal opacity-40 text-[10px]">cm</span>
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {sizes.map((s) => (
                        <tr key={s.id} className="border-b border-black/20">
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
            className="w-[70px] border-b border-black/20 focus:border-black outline-none px-1 py-1 text-[12px] bg-transparent"
        />
    )
}
