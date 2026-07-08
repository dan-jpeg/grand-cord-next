'use client'

import { useState, useTransition, useMemo } from 'react'
import {
    createCatalogGroup,
    updateCatalogGroup,
    deleteCatalogGroup,
    addProductToGroup,
    removeProductFromGroup,
    updateSiteSettings,
    createSizingAttribute,
    updateSizingAttribute,
    deleteSizingAttribute,
    setCategoryEnabled,
} from '@/app/admin/manage-catalog/actions'

type ProductLite = { id: string; name: string; slug: string }

type Group = {
    id: string
    name: string
    description: string | null
    showInCatalog: boolean
    showInSample: boolean
    showInSearch: boolean
    products: ProductLite[]
}

type Tab = 'settings' | 'groups' | 'sizing'

type SiteSettings = {
    showSearchInNav: boolean
    showSampleInNav: boolean
    scrollToTopOnCatalogTapMobile: boolean
    scrollToTopOnCatalogTapDesktop: boolean
}

type SizingAttribute = {
    id: string
    title: string
    description: string | null
    category: string
    enabled: boolean
}

export function ManageCatalogView({
    groups,
    allProducts,
    settings,
    sizingAttributes,
}: {
    groups: Group[]
    allProducts: ProductLite[]
    settings: SiteSettings
    sizingAttributes: SizingAttribute[]
}) {
    const [tab, setTab] = useState<Tab>('groups')

    return (
        <div className="max-w-[1200px] mx-auto font-inter">
            <h1 className="text-[14px] font-bold mb-8">Manage Catalog</h1>

            {/* Tabs */}
            <div className="flex gap-8 border-b border-neutral-200 mb-10">
                <TabButton active={tab === 'settings'} onClick={() => setTab('settings')}>
                    Catalog Settings
                </TabButton>
                <TabButton active={tab === 'groups'} onClick={() => setTab('groups')}>
                    Catalog Groups
                </TabButton>
                <TabButton active={tab === 'sizing'} onClick={() => setTab('sizing')}>
                    Sizing
                </TabButton>
            </div>

            {tab === 'settings' && <SettingsTab settings={settings} groups={groups} />}
            {tab === 'groups' && <GroupsTab groups={groups} allProducts={allProducts} />}
            {tab === 'sizing' && <SizingTab attributes={sizingAttributes} />}
        </div>
    )
}

function TabButton({
    active,
    onClick,
    children,
}: {
    active: boolean
    onClick: () => void
    children: React.ReactNode
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`text-[10pt] pb-3 -mb-px border-b-2 transition-colors ${
                active
                    ? 'border-black font-bold'
                    : 'border-transparent text-neutral-500 hover:text-black'
            }`}
        >
            {children}
        </button>
    )
}

function SettingsTab({
    settings,
    groups,
}: {
    settings: SiteSettings
    groups: Group[]
}) {
    const [pending, startTransition] = useTransition()

    const setSetting = (
        key:
            | 'showSearchInNav'
            | 'showSampleInNav'
            | 'scrollToTopOnCatalogTapMobile'
            | 'scrollToTopOnCatalogTapDesktop',
        next: boolean,
    ) => {
        startTransition(async () => {
            await updateSiteSettings({ [key]: next })
        })
    }

    const setGroupVisibility = (groupId: string, next: boolean) => {
        startTransition(async () => {
            await updateCatalogGroup(groupId, { showInCatalog: next })
        })
    }

    return (
        <div className="flex flex-col gap-10 max-w-[640px]">
            {/* Built-in nav items */}
            <section>
                <p className="text-[9pt] font-bold uppercase tracking-[0.05em] text-neutral-500 mb-3">
                    Nav items
                </p>
                <p className="text-[9pt] text-neutral-500 mb-4">
                    Show or hide built-in entries in the storefront catalog nav.
                </p>
                <div className="flex flex-col divide-y divide-neutral-200 border-y border-neutral-200">
                    <ToggleRow
                        label="Search"
                        description="The search affordance in the catalog nav."
                        active={settings.showSearchInNav}
                        disabled={pending}
                        onToggle={(v) => setSetting('showSearchInNav', v)}
                    />
                    <ToggleRow
                        label="Sample"
                        description="Link to the /sample page."
                        active={settings.showSampleInNav}
                        disabled={pending}
                        onToggle={(v) => setSetting('showSampleInNav', v)}
                    />
                </div>
            </section>

            {/* Behavior */}
            <section>
                <p className="text-[9pt] font-bold uppercase tracking-[0.05em] text-neutral-500 mb-3">
                    Behavior
                </p>
                <p className="text-[9pt] text-neutral-500 mb-4">
                    Storefront catalog nav interactions.
                </p>
                <div className="flex flex-col divide-y divide-neutral-200 border-y border-neutral-200">
                    <ToggleRow
                        label="Scroll to catalog on tap (mobile)"
                        description="On mobile, when the Catalog header is tapped to open the nav, smooth-scroll the page to the top of the catalog section."
                        active={settings.scrollToTopOnCatalogTapMobile}
                        disabled={pending}
                        onToggle={(v) => setSetting('scrollToTopOnCatalogTapMobile', v)}
                        onLabel="Enabled"
                        offLabel="Disabled"
                    />
                    <ToggleRow
                        label="Scroll to catalog on tap (desktop)"
                        description="On desktop, when the Catalog header is tapped to open the nav, smooth-scroll the page to the top of the catalog section."
                        active={settings.scrollToTopOnCatalogTapDesktop}
                        disabled={pending}
                        onToggle={(v) => setSetting('scrollToTopOnCatalogTapDesktop', v)}
                        onLabel="Enabled"
                        offLabel="Disabled"
                    />
                </div>
            </section>

            {/* Catalog groups */}
            <section>
                <p className="text-[9pt] font-bold uppercase tracking-[0.05em] text-neutral-500 mb-3">
                    Catalog groups
                </p>
                <p className="text-[9pt] text-neutral-500 mb-4">
                    Toggle which user-created groups appear in the catalog nav.
                    Create or edit groups in the Catalog Groups tab.
                </p>
                {groups.length === 0 ? (
                    <p className="text-[10pt] text-neutral-400">
                        No groups yet.
                    </p>
                ) : (
                    <div className="flex flex-col divide-y divide-neutral-200 border-y border-neutral-200">
                        {groups.map((g) => (
                            <ToggleRow
                                key={g.id}
                                label={g.name}
                                description={
                                    g.description ||
                                    `${g.products.length} item${g.products.length === 1 ? '' : 's'}`
                                }
                                active={g.showInCatalog}
                                disabled={pending}
                                onToggle={(v) => setGroupVisibility(g.id, v)}
                            />
                        ))}
                    </div>
                )}
            </section>
        </div>
    )
}

function ToggleRow({
    label,
    description,
    active,
    onToggle,
    disabled,
    onLabel = 'Visible',
    offLabel = 'Hidden',
}: {
    label: string
    description?: string
    active: boolean
    onToggle: (next: boolean) => void
    disabled?: boolean
    onLabel?: string
    offLabel?: string
}) {
    return (
        <div className="flex items-center justify-between py-3">
            <div className="pr-6">
                <p className="text-[10pt] font-bold">{label}</p>
                {description && (
                    <p className="text-[9pt] text-neutral-500">{description}</p>
                )}
            </div>
            <button
                type="button"
                disabled={disabled}
                onClick={() => onToggle(!active)}
                className={`shrink-0 px-3 py-1 rounded-[2px] border text-[9pt] transition-colors ${
                    active
                        ? 'bg-black text-white border-black'
                        : 'bg-white text-neutral-500 border-neutral-300 hover:border-black hover:text-black'
                }`}
            >
                {active ? onLabel : offLabel}
            </button>
        </div>
    )
}

function GroupsTab({
    groups,
    allProducts,
}: {
    groups: Group[]
    allProducts: ProductLite[]
}) {
    const [creating, setCreating] = useState(false)
    const [name, setName] = useState('')
    const [description, setDescription] = useState('')
    const [pending, startTransition] = useTransition()

    const submitCreate = () => {
        const trimmed = name.trim()
        if (!trimmed) return
        startTransition(async () => {
            await createCatalogGroup({ name: trimmed, description: description.trim() })
            setName('')
            setDescription('')
            setCreating(false)
        })
    }

    return (
        <div className="flex flex-col gap-6">
            {/* Create row */}
            <div className="flex items-start justify-between">
                <p className="text-[9pt] text-neutral-500">
                    {groups.length} group{groups.length === 1 ? '' : 's'}
                </p>
                {!creating ? (
                    <button
                        type="button"
                        onClick={() => setCreating(true)}
                        className="text-[10pt] font-bold underline underline-offset-2"
                    >
                        + New group
                    </button>
                ) : (
                    <div className="flex flex-col gap-2 w-[360px]">
                        <input
                            autoFocus
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Group name"
                            className="border border-neutral-300 px-3 py-2 text-[10pt]"
                        />
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Description (optional)"
                            rows={2}
                            className="border border-neutral-300 px-3 py-2 text-[10pt] resize-none"
                        />
                        <div className="flex gap-3 justify-end">
                            <button
                                type="button"
                                onClick={() => {
                                    setCreating(false)
                                    setName('')
                                    setDescription('')
                                }}
                                className="text-[10pt] text-neutral-500 hover:text-black"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={submitCreate}
                                disabled={pending || !name.trim()}
                                className="text-[10pt] font-bold underline underline-offset-2 disabled:opacity-30"
                            >
                                {pending ? 'Creating…' : 'Create'}
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Group list */}
            {groups.length === 0 ? (
                <p className="text-[10pt] text-neutral-400 py-10 text-center">
                    No groups yet — create your first group above.
                </p>
            ) : (
                <div className="flex flex-col gap-3">
                    {groups.map((g) => (
                        <GroupCard key={g.id} group={g} allProducts={allProducts} />
                    ))}
                </div>
            )}
        </div>
    )
}

function GroupCard({
    group,
    allProducts,
}: {
    group: Group
    allProducts: ProductLite[]
}) {
    const [expanded, setExpanded] = useState(false)
    const [editing, setEditing] = useState(false)
    const [name, setName] = useState(group.name)
    const [description, setDescription] = useState(group.description ?? '')
    const [pending, startTransition] = useTransition()

    const memberIds = useMemo(() => new Set(group.products.map((p) => p.id)), [group.products])
    const nonMembers = useMemo(
        () => allProducts.filter((p) => !memberIds.has(p.id)),
        [allProducts, memberIds],
    )

    const toggleFlag = (
        key: 'showInCatalog' | 'showInSample' | 'showInSearch',
        next: boolean,
    ) => {
        startTransition(async () => {
            await updateCatalogGroup(group.id, { [key]: next })
        })
    }

    const saveMeta = () => {
        startTransition(async () => {
            await updateCatalogGroup(group.id, {
                name: name.trim() || group.name,
                description: description.trim() || null,
            })
            setEditing(false)
        })
    }

    const remove = () => {
        if (!confirm(`Delete group "${group.name}"? Products are not deleted.`)) return
        startTransition(async () => {
            await deleteCatalogGroup(group.id)
        })
    }

    const add = (productId: string) => {
        startTransition(async () => {
            await addProductToGroup(group.id, productId)
        })
    }

    const removeMember = (productId: string) => {
        startTransition(async () => {
            await removeProductFromGroup(group.id, productId)
        })
    }

    return (
        <div className="border border-neutral-200">
            {/* Header row */}
            <div className="flex items-center justify-between px-4 py-3">
                <button
                    type="button"
                    onClick={() => setExpanded((v) => !v)}
                    className="flex items-center gap-3 text-left"
                >
                    <span className="text-[8pt] w-3">{expanded ? '▼' : '▸'}</span>
                    <div>
                        <p className="text-[10pt] font-bold">{group.name}</p>
                        {group.description && (
                            <p className="text-[9pt] text-neutral-500">{group.description}</p>
                        )}
                    </div>
                </button>
                <div className="flex items-center gap-6 text-[9pt]">
                    <VisibilityChip
                        label="Catalog"
                        active={group.showInCatalog}
                        disabled={pending}
                        onToggle={(v) => toggleFlag('showInCatalog', v)}
                    />
                    <VisibilityChip
                        label="Sample"
                        active={group.showInSample}
                        disabled={pending}
                        onToggle={(v) => toggleFlag('showInSample', v)}
                    />
                    <VisibilityChip
                        label="Search"
                        active={group.showInSearch}
                        disabled={pending}
                        onToggle={(v) => toggleFlag('showInSearch', v)}
                    />
                    <span className="text-neutral-400 tabular-nums">
                        {group.products.length} item{group.products.length === 1 ? '' : 's'}
                    </span>
                </div>
            </div>

            {/* Expanded body */}
            {expanded && (
                <div className="border-t border-neutral-200 px-4 py-4 flex flex-col gap-5">
                    {/* Edit name/description */}
                    {editing ? (
                        <div className="flex flex-col gap-2 max-w-[420px]">
                            <input
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="border border-neutral-300 px-3 py-2 text-[10pt]"
                            />
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                rows={2}
                                className="border border-neutral-300 px-3 py-2 text-[10pt] resize-none"
                            />
                            <div className="flex gap-3 justify-end">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setEditing(false)
                                        setName(group.name)
                                        setDescription(group.description ?? '')
                                    }}
                                    className="text-[10pt] text-neutral-500"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    disabled={pending}
                                    onClick={saveMeta}
                                    className="text-[10pt] font-bold underline underline-offset-2"
                                >
                                    Save
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex gap-4 text-[9pt]">
                            <button
                                type="button"
                                onClick={() => setEditing(true)}
                                className="underline underline-offset-2"
                            >
                                Edit name / description
                            </button>
                            <button
                                type="button"
                                onClick={remove}
                                className="text-red-600 underline underline-offset-2"
                            >
                                Delete group
                            </button>
                        </div>
                    )}

                    {/* Members */}
                    <div>
                        <p className="text-[9pt] font-bold mb-2 uppercase tracking-[0.05em] text-neutral-500">
                            Items
                        </p>
                        {group.products.length === 0 ? (
                            <p className="text-[10pt] text-neutral-400">No items yet.</p>
                        ) : (
                            <ul className="flex flex-col">
                                {group.products.map((p) => (
                                    <li
                                        key={p.id}
                                        className="flex items-center justify-between py-1 text-[10pt]"
                                    >
                                        <span>{p.name}</span>
                                        <button
                                            type="button"
                                            onClick={() => removeMember(p.id)}
                                            className="text-[9pt] text-neutral-500 hover:text-red-600"
                                        >
                                            remove
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    {/* Add picker */}
                    <AddProductPicker products={nonMembers} onAdd={add} disabled={pending} />
                </div>
            )}
        </div>
    )
}

function VisibilityChip({
    label,
    active,
    onToggle,
    disabled,
}: {
    label: string
    active: boolean
    onToggle: (next: boolean) => void
    disabled?: boolean
}) {
    return (
        <button
            type="button"
            disabled={disabled}
            onClick={() => onToggle(!active)}
            className={`px-2 py-[2px] rounded-[2px] border transition-colors ${
                active
                    ? 'bg-black text-white border-black'
                    : 'bg-white text-neutral-500 border-neutral-300 hover:border-black hover:text-black'
            }`}
        >
            {label}
        </button>
    )
}

function AddProductPicker({
    products,
    onAdd,
    disabled,
}: {
    products: ProductLite[]
    onAdd: (id: string) => void
    disabled?: boolean
}) {
    const [query, setQuery] = useState('')
    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase()
        if (!q) return products.slice(0, 12)
        return products
            .filter((p) => p.name.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q))
            .slice(0, 12)
    }, [products, query])

    if (products.length === 0) {
        return (
            <p className="text-[9pt] text-neutral-400">All products are already in this group.</p>
        )
    }

    return (
        <div>
            <p className="text-[9pt] font-bold mb-2 uppercase tracking-[0.05em] text-neutral-500">
                Add item
            </p>
            <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search products…"
                className="border border-neutral-300 px-3 py-2 text-[10pt] w-full max-w-[420px] mb-2"
            />
            <ul className="flex flex-col max-h-[200px] overflow-y-auto">
                {filtered.map((p) => (
                    <li key={p.id} className="flex items-center justify-between py-1 text-[10pt]">
                        <span>{p.name}</span>
                        <button
                            type="button"
                            disabled={disabled}
                            onClick={() => onAdd(p.id)}
                            className="text-[9pt] underline underline-offset-2"
                        >
                            add
                        </button>
                    </li>
                ))}
                {filtered.length === 0 && (
                    <li className="text-[9pt] text-neutral-400 py-2">No matches.</li>
                )}
            </ul>
        </div>
    )
}

function SizingTab({ attributes }: { attributes: SizingAttribute[] }) {
    const [pending, startTransition] = useTransition()
    const [creating, setCreating] = useState(false)
    const [title, setTitle] = useState('')
    const [description, setDescription] = useState('')
    const [category, setCategory] = useState('')

    const grouped = useMemo(() => {
        const map = new Map<string, SizingAttribute[]>()
        for (const a of attributes) {
            const list = map.get(a.category) ?? []
            list.push(a)
            map.set(a.category, list)
        }
        return Array.from(map.entries())
    }, [attributes])

    const existingCategories = useMemo(
        () => Array.from(new Set(attributes.map((a) => a.category))).sort(),
        [attributes],
    )

    const submitCreate = () => {
        const t = title.trim()
        const c = category.trim()
        if (!t || !c) return
        startTransition(async () => {
            await createSizingAttribute({
                title: t,
                category: c,
                description: description.trim(),
            })
            setTitle('')
            setDescription('')
            setCategory('')
            setCreating(false)
        })
    }

    const toggleAttribute = (id: string, next: boolean) => {
        startTransition(async () => {
            await updateSizingAttribute(id, { enabled: next })
        })
    }

    const toggleCategory = (cat: string, next: boolean) => {
        startTransition(async () => {
            await setCategoryEnabled(cat, next)
        })
    }

    return (
        <div className="flex flex-col gap-8 max-w-[820px]">
            {/* Create row */}
            <div className="flex items-start justify-between">
                <p className="text-[9pt] text-neutral-500">
                    {attributes.length} attribute{attributes.length === 1 ? '' : 's'}{' '}
                    across {existingCategories.length} categor
                    {existingCategories.length === 1 ? 'y' : 'ies'}
                </p>
                {!creating ? (
                    <button
                        type="button"
                        onClick={() => setCreating(true)}
                        className="text-[10pt] font-bold underline underline-offset-2"
                    >
                        + New attribute
                    </button>
                ) : (
                    <div className="flex flex-col gap-2 w-[420px]">
                        <input
                            autoFocus
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Title (e.g. Length)"
                            className="border border-neutral-300 px-3 py-2 text-[10pt]"
                        />
                        <input
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Description (e.g. back of collar to bottom hem)"
                            className="border border-neutral-300 px-3 py-2 text-[10pt]"
                        />
                        <input
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                            placeholder="Category (e.g. Upper Body)"
                            list="sizing-categories"
                            className="border border-neutral-300 px-3 py-2 text-[10pt]"
                        />
                        <datalist id="sizing-categories">
                            {existingCategories.map((c) => (
                                <option key={c} value={c} />
                            ))}
                        </datalist>
                        <div className="flex gap-3 justify-end">
                            <button
                                type="button"
                                onClick={() => {
                                    setCreating(false)
                                    setTitle('')
                                    setDescription('')
                                    setCategory('')
                                }}
                                className="text-[10pt] text-neutral-500 hover:text-black"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={submitCreate}
                                disabled={pending || !title.trim() || !category.trim()}
                                className="text-[10pt] font-bold underline underline-offset-2 disabled:opacity-30"
                            >
                                {pending ? 'Adding…' : 'Add'}
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {grouped.length === 0 ? (
                <p className="text-[10pt] text-neutral-400 py-10 text-center">
                    No sizing attributes yet.
                </p>
            ) : (
                <div className="flex flex-col gap-8">
                    {grouped.map(([cat, items]) => {
                        const allEnabled = items.every((i) => i.enabled)
                        const noneEnabled = items.every((i) => !i.enabled)
                        return (
                            <section key={cat}>
                                <div className="flex items-center justify-between mb-3">
                                    <p className="text-[9pt] font-bold uppercase tracking-[0.05em] text-neutral-500">
                                        {cat}
                                    </p>
                                    <button
                                        type="button"
                                        disabled={pending}
                                        onClick={() =>
                                            toggleCategory(cat, !allEnabled)
                                        }
                                        className="text-[9pt] underline underline-offset-2"
                                    >
                                        {allEnabled
                                            ? 'Disable all'
                                            : noneEnabled
                                              ? 'Enable all'
                                              : 'Enable all'}
                                    </button>
                                </div>
                                <div className="grid grid-cols-[1fr_2fr_auto_auto] gap-x-4 gap-y-2 items-center text-[10pt]">
                                    {items.map((a) => (
                                        <SizingRow
                                            key={a.id}
                                            attribute={a}
                                            disabled={pending}
                                            onToggle={(v) => toggleAttribute(a.id, v)}
                                        />
                                    ))}
                                </div>
                            </section>
                        )
                    })}
                </div>
            )}
        </div>
    )
}

function SizingRow({
    attribute,
    onToggle,
    disabled,
}: {
    attribute: SizingAttribute
    onToggle: (next: boolean) => void
    disabled?: boolean
}) {
    const [editing, setEditing] = useState(false)
    const [title, setTitle] = useState(attribute.title)
    const [description, setDescription] = useState(attribute.description ?? '')
    const [category, setCategory] = useState(attribute.category)
    const [pending, startTransition] = useTransition()

    const save = () => {
        startTransition(async () => {
            await updateSizingAttribute(attribute.id, {
                title,
                description,
                category,
            })
            setEditing(false)
        })
    }

    const remove = () => {
        if (!confirm(`Delete "${attribute.title}"?`)) return
        startTransition(async () => {
            await deleteSizingAttribute(attribute.id)
        })
    }

    if (editing) {
        return (
            <>
                <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="border border-neutral-300 px-2 py-1 text-[10pt]"
                />
                <input
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="border border-neutral-300 px-2 py-1 text-[10pt]"
                />
                <input
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="border border-neutral-300 px-2 py-1 text-[10pt] w-[140px]"
                />
                <div className="flex gap-2">
                    <button
                        type="button"
                        disabled={pending}
                        onClick={save}
                        className="text-[9pt] font-bold underline underline-offset-2"
                    >
                        Save
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            setEditing(false)
                            setTitle(attribute.title)
                            setDescription(attribute.description ?? '')
                            setCategory(attribute.category)
                        }}
                        className="text-[9pt] text-neutral-500"
                    >
                        Cancel
                    </button>
                </div>
            </>
        )
    }

    return (
        <>
            <span className={`font-bold ${attribute.enabled ? '' : 'opacity-40'}`}>
                {attribute.title}
            </span>
            <span className={`text-neutral-600 ${attribute.enabled ? '' : 'opacity-40'}`}>
                {attribute.description}
            </span>
            <button
                type="button"
                disabled={disabled}
                onClick={() => onToggle(!attribute.enabled)}
                className={`shrink-0 px-2 py-[2px] rounded-[2px] border text-[9pt] transition-colors ${
                    attribute.enabled
                        ? 'bg-black text-white border-black'
                        : 'bg-white text-neutral-500 border-neutral-300 hover:border-black hover:text-black'
                }`}
            >
                {attribute.enabled ? 'On' : 'Off'}
            </button>
            <div className="flex gap-2 text-[9pt]">
                <button
                    type="button"
                    onClick={() => setEditing(true)}
                    className="underline underline-offset-2"
                >
                    edit
                </button>
                <button
                    type="button"
                    onClick={remove}
                    className="text-neutral-500 hover:text-red-600"
                >
                    delete
                </button>
            </div>
        </>
    )
}
