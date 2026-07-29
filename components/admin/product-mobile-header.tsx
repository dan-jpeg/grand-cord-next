'use client'

import Link from 'next/link'

export type ProductMobileTab = 'images' | 'listing' | 'inventory'
export type SaveStatus = 'idle' | 'saving' | 'saved'

/** Blue selection dot next to the active tab (Figma #002AFF, 7px). */
function ActiveDot() {
    return <span className="inline-block w-[7px] h-[7px] rounded-full bg-[#002AFF] shrink-0" />
}

function Tab({
    active,
    href,
    children,
}: {
    active: boolean
    href: string
    children: React.ReactNode
}) {
    if (active) {
        return (
            <span className="flex items-center gap-1.5 opacity-90">
                <ActiveDot />
                {children}
            </span>
        )
    }
    return (
        <Link href={href} className="opacity-20 transition-opacity hover:opacity-40">
            {children}
        </Link>
    )
}

/**
 * Shared, fixed top-right chrome for the product editor on mobile: the save
 * status alert, the item-name badge, and the Images / Inventory / Listing tab
 * bar. Stays mounted and pinned so it doesn't re-animate as the body swaps.
 * AdminNav (the top-left eye) is rendered separately by each page.
 */
export function ProductMobileHeader({
    productId,
    productSlug,
    name,
    active,
    status = 'idle',
    hiddenClass = 'lg:hidden',
}: {
    productId: string
    /** Store-facing slug; when set, the item-name badge links to the live product page. */
    productSlug?: string
    name: string
    active: ProductMobileTab
    status?: SaveStatus
    /** Breakpoint at which the mobile header hides (route's desktop breakpoint). */
    hiddenClass?: string
}) {
    return (
        <div className={`${hiddenClass} fixed top-0 inset-x-0 z-40 bg-white`}>
            {/* Save status + item-name badge (right). Eye/label sit at top-left. */}
            <div className="flex items-center justify-end px-3 pt-3 min-h-[13px]">
                <div className="flex items-center gap-3">
                    <span
                        className={`text-[10px] transition-opacity ${
                            status === 'idle' ? 'opacity-0' : 'opacity-40'
                        }`}
                    >
                        {status === 'saving' ? 'Saving…' : 'Saved'}
                    </span>
                    {productSlug ? (
                        <Link
                            href={`/products/${productSlug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center bg-[#e8e6e6] px-2 h-[13px]"
                        >
                            <span className="text-[12px] font-bold leading-none">{name}</span>
                        </Link>
                    ) : (
                        <div className="flex items-center bg-[#e8e6e6] px-2 h-[13px]">
                            <span className="text-[12px] font-bold leading-none">{name}</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Tab bar — spread full width; active tab gets the blue dot. */}
            <div className="flex items-center justify-between px-4 pt-5 pb-3 text-[12px] font-bold leading-none">
                <Tab active={active === 'images'} href={`/admin/products/${productId}/images`}>
                    Images
                </Tab>
                <Tab active={active === 'inventory'} href={`/admin/products/${productId}/edit?tab=sizing`}>
                    Inventory
                </Tab>
                <Tab active={active === 'listing'} href={`/admin/products/${productId}/edit?tab=listing`}>
                    Listing
                </Tab>
            </div>
        </div>
    )
}
