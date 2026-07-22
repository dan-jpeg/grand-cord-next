'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { useCart } from '@/contexts/cart-context'

type NavConfig = {
    showSearch: boolean
    showSample: boolean
    scrollToTopOnTapMobile: boolean
    scrollToTopOnTapDesktop: boolean
    groups: { id: string; name: string; slug: string }[]
}

type CatalogNavProps = {
    productCount: number
    onSearchChange?: (query: string) => void
    mobileLayout?: '1x1' | '2x2' | '3x3'
    onLayoutChange?: (layout: '1x1' | '2x2' | '3x3') => void
    isLocked?: boolean
    navConfig?: NavConfig
    /**
     * When set, the "Catalog" heading becomes a link to this href instead of
     * toggling the expanded menu. Used when the nav is rendered above pages
     * that don't own the catalog grid (product, cart, checkout, order) so
     * clicking Catalog navigates back to the catalog home.
     */
    catalogHomeHref?: string
}

export function CatalogNav({
                               productCount,
                               onSearchChange,
                               mobileLayout = '1x1',
                               onLayoutChange,
                               isLocked = false,
                               navConfig,
                               catalogHomeHref,
                           }: CatalogNavProps) {
    const BACKSPACE_SPEED = 300
    const TYPE_SPEED = 120
    const EMPTY_PAUSE = 190
    const POST_BLINK_PAUSE = 200
    const FINAL_HIDE_DELAY = 250

    const { totalItems } = useCart()

    const [isSearchOpen, setIsSearchOpen] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const [showLayout, setShowLayout] = useState(false)
    const [layoutOpacity, setLayoutOpacity] = useState(1)
    const [lastScrollY, setLastScrollY] = useState(0)
    const [isExpanded, setIsExpanded] = useState(false)
    const [isDesktop, setIsDesktop] = useState(false)
    const [isStuck, setIsStuck] = useState(false)
    const [isMobileSearchLocked, setIsMobileSearchLocked] = useState(false)

    const [displayNumber, setDisplayNumber] = useState('')
    const [showCursor, setShowCursor] = useState(false)
    const [cursorBlinkCount, setCursorBlinkCount] = useState(0)
    const [showSearchArrow, setShowSearchArrow] = useState(true)

    const prevTotalItems = useRef(0)
    const layoutRef = useRef<HTMLDivElement>(null)
    const navRef = useRef<HTMLDivElement>(null)
    const animationRef = useRef<{
        interval?: ReturnType<typeof setInterval>
        timeout?: ReturnType<typeof setTimeout>
    }>({})
    const wasLockedRef = useRef(false)
    const manuallyOpenedRef = useRef(false)
    const mobileBlurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    const clearAnimation = () => {
        if (animationRef.current.interval) clearInterval(animationRef.current.interval)
        if (animationRef.current.timeout) clearTimeout(animationRef.current.timeout)
    }

    useEffect(() => {
        const checkDesktop = () => setIsDesktop(window.innerWidth >= 1024)
        checkDesktop()
        window.addEventListener('resize', checkDesktop)
        return () => window.removeEventListener('resize', checkDesktop)
    }, [])

    useEffect(() => {
        return () => {
            if (mobileBlurTimeoutRef.current) clearTimeout(mobileBlurTimeoutRef.current)
        }
    }, [])

    // Detect when sticky element is actually stuck (desktop only)
    useEffect(() => {
        if (!isDesktop || !navRef.current) return

        const observer = new IntersectionObserver(
            ([entry]) => {
                setIsStuck(!entry.isIntersecting)
            },
            { threshold: [1], rootMargin: '-1px 0px 0px 0px' }
        )

        const sentinel = document.createElement('div')
        sentinel.style.position = 'absolute'
        sentinel.style.top = '-1px'
        sentinel.style.height = '1px'
        sentinel.style.width = '1px'

        navRef.current.parentElement?.insertBefore(sentinel, navRef.current)
        observer.observe(sentinel)

        return () => {
            observer.disconnect()
            sentinel.remove()
        }
    }, [isDesktop])

    // Scroll-based auto-open was removed: nav only opens via explicit tap on
    // "Catalog". Other scroll effects (sheet growth in the wrapper, isStuck
    // detection, layout fade-out at bottom) are untouched.

    // Layout fade-out at bottom
    useEffect(() => {
        if (!showLayout || isDesktop) return
        const checkLayoutPos = () => {
            if (layoutRef.current) {
                const rect = layoutRef.current.getBoundingClientRect()
                const dist = window.innerHeight - rect.bottom
                setLayoutOpacity(dist < 100 ? Math.max(0, dist / 100) : 1)
            }
        }
        window.addEventListener('scroll', checkLayoutPos, { passive: true })
        return () => window.removeEventListener('scroll', checkLayoutPos)
    }, [showLayout, isDesktop])

    // Typewriter Cart Animation
    useEffect(() => {
        clearAnimation()
        const oldValue = prevTotalItems.current.toString()
        const newValue = totalItems.toString()

        if (totalItems <= prevTotalItems.current) {
            setDisplayNumber(newValue)
            setShowCursor(false)
            prevTotalItems.current = totalItems
            return
        }

        setShowCursor(true)
        setCursorBlinkCount(0)
        setDisplayNumber(oldValue)

        let index = oldValue.length
        animationRef.current.interval = setInterval(() => {
            index--
            setDisplayNumber(oldValue.slice(0, Math.max(index, 0)))
            if (index <= 0) {
                clearInterval(animationRef.current.interval)
                animationRef.current.timeout = setTimeout(() => {
                    let typeIndex = 0
                    animationRef.current.interval = setInterval(() => {
                        typeIndex++
                        setDisplayNumber(newValue.slice(0, typeIndex))
                        if (typeIndex >= newValue.length) {
                            clearInterval(animationRef.current.interval)
                            animationRef.current.timeout = setTimeout(() => setCursorBlinkCount(1), POST_BLINK_PAUSE)
                        }
                    }, TYPE_SPEED)
                }, EMPTY_PAUSE)
            }
        }, BACKSPACE_SPEED)

        prevTotalItems.current = totalItems
        return clearAnimation
    }, [totalItems])

    useEffect(() => {
        if (isDesktop || !isMobileSearchLocked || !isSearchOpen) {
            setShowSearchArrow(true)
            return
        }

        const interval = setInterval(() => {
            setShowSearchArrow(prev => !prev)
        }, 900)

        return () => clearInterval(interval)
    }, [isDesktop, isMobileSearchLocked, isSearchOpen])

    const cursor = (
        <AnimatePresence>
            {showCursor && (
                <motion.span
                    key={cursorBlinkCount}
                    initial={{ opacity: 1 }}
                    animate={{ opacity: [1, 1, 0, 0, 1] }}
                    transition={{
                        duration: 1.7,
                        times: [0, 0.25, 0.35, 0.85, 1],
                        ease: 'linear',
                        repeat: cursorBlinkCount > 0 ? cursorBlinkCount - 1 : Infinity,
                    }}
                    onAnimationComplete={() => {
                        if (cursorBlinkCount > 0) {
                            setTimeout(() => { setCursorBlinkCount(0); setShowCursor(false); }, FINAL_HIDE_DELAY)
                        }
                    }}
                    className="inline-block font-mono font-semibold w-[2.5px] h-[16px] bg-black ml-[2px]"
                />
            )}
        </AnimatePresence>
    )

    const handleToggleExpand = () => {
        const newExpandedState = !isExpanded

        if (!isDesktop) {
            // Re-open full catalog controls only when user explicitly taps Catalog.
            if (isMobileSearchLocked) {
                setIsMobileSearchLocked(false)
            }
            // Layout switcher used to be driven by scroll; tie it to the
            // explicit toggle now so it appears whenever the nav is open.
            setShowLayout(newExpandedState)

            // Track if user manually opened it while at top
            if (newExpandedState && isLocked) {
                manuallyOpenedRef.current = true
            } else {
                manuallyOpenedRef.current = false
            }
        }

        setIsExpanded(newExpandedState)
    }

    // Click handler attached to the nav's outer container. Fires whenever
    // the user clicks the navbar background or any non-link child. Skipped
    // when the click lands on a real link (cart, sample, group links) so
    // navigation isn't hijacked.
    const handleNavBackgroundClick = (e: React.MouseEvent) => {
        const scrollEnabled = isDesktop
            ? navConfig?.scrollToTopOnTapDesktop
            : navConfig?.scrollToTopOnTapMobile
        if (!scrollEnabled) return
        const target = e.target as HTMLElement | null
        if (target?.closest('a')) return
        scrollToCatalogTop()
    }

    const handleSearchChange = (v: string) => {
        setSearchQuery(v)
        onSearchChange?.(v)
        if (!v.trim()) setIsMobileSearchLocked(false)
    }

    const isIOSMobile = () => {
        if (typeof navigator === 'undefined') return false
        return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
            (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    }
    const handleSearchBlur = () => {
        if (isDesktop) {
            setIsSearchOpen(false)
            return
        }
        if (mobileBlurTimeoutRef.current) clearTimeout(mobileBlurTimeoutRef.current)
        mobileBlurTimeoutRef.current = setTimeout(() => {
            if (searchQuery.trim()) {
                setIsSearchOpen(false)
                setIsExpanded(false)
                setShowLayout(false)
                setIsMobileSearchLocked(true)
                return
            }

            setIsSearchOpen(false)
            setIsExpanded(false)
            setShowLayout(false)
            setIsMobileSearchLocked(false)
        }, 80)
    }
    const editSearch = () => {
        if (!isDesktop && isMobileSearchLocked) {
            setSearchQuery('')
            onSearchChange?.('')
            setIsSearchOpen(true)
            setIsExpanded(false)
            return
        }
        setIsSearchOpen(true)
        setIsExpanded(true)
    }
    const scrollToCatalogTop = () => {
        // The page renders two <CatalogSection> instances (mobile + desktop
        // branches), so two elements with id="catalog" exist in the DOM. On
        // desktop the mobile one comes first and is hidden (rect 0,0,0,0),
        // which made getElementById + scrollIntoView a silent no-op. Pick the
        // first visible #catalog instead.
        const section = Array.from(document.querySelectorAll<HTMLElement>('#catalog'))
            .find(el => el.getBoundingClientRect().height > 0)
        if (!section) return

        // The section has its own top padding, so scrolling the section into
        // view lands above the nav with a padding gap showing. On desktop,
        // scroll a zero-height marker (placed right after that padding)
        // into view instead so it lands flush at the top of the viewport.
        // (Can't target the sticky nav itself: once pinned, its rect always
        // reads top:0, making scrollIntoView on it a no-op.)
        const anchor = section.querySelector<HTMLElement>('[data-catalog-scroll-anchor]')
        const target = anchor && anchor.offsetParent !== null ? anchor : section

        target.scrollIntoView({
            behavior: !isDesktop && isIOSMobile() ? 'auto' : 'smooth',
            block: 'start',
        })
    }
    const submitSearch = () => {
        scrollToCatalogTop()

        if (isDesktop) {
            setIsSearchOpen(false)
            return
        }

        const hasQuery = !!searchQuery.trim()
        setIsSearchOpen(false)
        setIsExpanded(false)
        setShowLayout(false)
        setIsMobileSearchLocked(hasQuery)
    }
    const hasDesktopMenuOptions = (navConfig?.showSample ?? true) ||
        (navConfig?.showSearch ?? true) ||
        !!(navConfig?.groups && navConfig.groups.length > 0)
    const showingBreadcrumb = !isSearchOpen && searchQuery
    const isDesktopSearchMode = !!searchQuery.trim() && !isSearchOpen
    const showMainContentMobile = isExpanded || (isMobileSearchLocked && isSearchOpen)
    const showMainContentDesktop = isExpanded && !isDesktopSearchMode && hasDesktopMenuOptions
    const isDesktopCollapsed = (!isExpanded || !hasDesktopMenuOptions) && !isDesktopSearchMode

    /*
     * Two separate JSX trees — one for mobile, one for desktop. Both share
     * all state, effects, and handlers in this component, but their markup
     * and styling can diverge freely without `lg:` prefixes.
     *
     * `lg:hidden` shows the mobile tree only below the lg breakpoint;
     * `hidden lg:block` shows the desktop tree only at lg and above.
     */
    return (
        <>
            {/* ============================== MOBILE ============================== */}
            <div
                className="lg:hidden bg-transparent w-full"
                data-catalog-nav
                onClick={handleNavBackgroundClick}
            >
                <div className="flex flex-col pl-4 pr-10 relative transition-all gap-3 pt-6 pb-6 min-h-[72px]">
                    {/* Header Row */}
                    <div className="flex items-center justify-between relative z-10 w-full">
                        {catalogHomeHref ? (
                            <Link href={catalogHomeHref} scroll={false}>
                                <h2 className="text-[8.5pt] pl-8 font-bold opacity-90">Catalog</h2>
                            </Link>
                        ) : (
                            <button onClick={handleToggleExpand}>
                                <h2 className="text-[8.5pt] pl-8 font-bold opacity-90">Catalog</h2>
                            </button>
                        )}
                        <Link href="/cart" className="relative text-right flex items-end gap-2">
                            <span className="inline-flex items-end text-right min-w-[20px] text-[9pt] font-bold tabular-nums">
                                {displayNumber}{cursor}
                            </span>
                        </Link>
                    </div>

                    {/* Search Breadcrumb (collapsed) */}
                    {showingBreadcrumb && !isExpanded && (
                        <div className="-ml-4 -mr-10 pl-4 pr-10 py-2 bg-[#FCFDF0] z-10">
                            <button onClick={editSearch} className="text-[9pt] font-bold text-left">▸ {searchQuery}</button>
                        </div>
                    )}

                    {/* Expanded Content */}
                    <AnimatePresence>
                        {showMainContentMobile && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0 }}
                                className={`flex flex-col gap-3 ${
                                    isSearchOpen ? 'overflow-visible' : 'overflow-hidden'
                                }`}
                            >
                                {!isMobileSearchLocked && (
                                    <div className="flex flex-col gap-3 text-[9pt] z-10">
                                        {(navConfig?.showSample ?? true) && (
                                            <Link href="/sample" className="hover:underline">Sample</Link>
                                        )}
                                        {(navConfig?.showSearch ?? true) && (
                                            <button onClick={() => setIsSearchOpen(!isSearchOpen)} className="text-left hover:underline">Search</button>
                                        )}
                                        {navConfig?.groups?.map((g) => (
                                            <Link
                                                key={g.id}
                                                href={`/?group=${g.slug}`}
                                                className="hover:underline"
                                            >
                                                {g.name}
                                            </Link>
                                        ))}
                                    </div>
                                )}

                                {isSearchOpen && (
                                    <form
                                        className="flex items-center gap-2 -ml-4 -mr-10 pl-4 pr-10 py-2 bg-[#FCFDF0]"
                                        onSubmit={(e) => {
                                            e.preventDefault()
                                            submitSearch()
                                        }}
                                    >
                                        {isMobileSearchLocked && (
                                            <span
                                                aria-hidden
                                                className="text-[9pt] font-bold"
                                                style={{ visibility: showSearchArrow ? 'visible' : 'hidden' }}
                                            >
                                                ▸
                                            </span>
                                        )}
                                        <input
                                            autoFocus
                                            className="bg-transparent text-[9pt] outline-none z-10 w-full min-w-0"
                                            value={searchQuery}
                                            onChange={(e) => handleSearchChange(e.target.value)}
                                            onBlur={handleSearchBlur}
                                            enterKeyHint="search"
                                            autoCapitalize="none"
                                            autoCorrect="off"
                                            spellCheck={false}
                                            placeholder=""
                                        />
                                    </form>
                                )}

                                {showingBreadcrumb && (
                                    <div className="text-[9pt] z-10">
                                        <button onClick={editSearch} className="hover:underline">▸ {searchQuery}</button>
                                    </div>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Layout Switcher (mobile only) */}
                    <AnimatePresence>
                        {showLayout && !isMobileSearchLocked && !isSearchOpen && (
                            <motion.div
                                ref={layoutRef}
                                initial={{ opacity: 0, y: -40 }}
                                animate={{ opacity: layoutOpacity, y: 0 }}
                                exit={{ opacity: 0, y: -40 }}
                                transition={{ duration: 0.17 }}
                                className="absolute left-0 right-0 top-full -mt-2 pt-4 pb-4 grid grid-cols-[auto_1fr_auto] bg-white items-center text-[9pt] pl-12  md:pr-8"
                            >
                                <span>Layout</span>
                                <div className="flex gap-20 justify-center">
                                    {(['1x1', '2x2', '3x3'] as const).map((l) => (
                                        <button
                                            key={l}
                                            onClick={() => onLayoutChange?.(l)}
                                            className={mobileLayout === l ? 'font-bold' : 'text-neutral-400'}
                                        >
                                            {l.replace('x', ' × ')}
                                        </button>
                                    ))}
                                </div>
                                <div />
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* ============================== DESKTOP ============================== */}
            <div
                ref={navRef}
                className={`hidden lg:block bg-white w-full ${
                    isDesktopSearchMode
                        ? 'min-h-0'
                        : isDesktopCollapsed
                            ? 'min-h-[60px]'
                            : 'min-h-[120px]'
                }`}
                data-catalog-nav
                onClick={handleNavBackgroundClick}
            >
                <div className={`flex flex-col pr-[2vw] pl-[calc(5vw+0px)] relative transition-all ${
                    isDesktopSearchMode
                        ? 'gap-4 pt-6 pb-0'
                        : isDesktopCollapsed
                            ? 'gap-3 pt-4 pb-'
                            : 'gap-3 pt-6 pb-6'
                }`}>
                    {/* Header Row */}
                    <div className="flex items-center justify-between relative z-10 w-full">
                        {catalogHomeHref ? (
                            <Link href={catalogHomeHref} scroll={false}>
                                <h2 className="text-[8.5pt]  font-bold opacity-90">Catalog</h2>
                            </Link>
                        ) : (
                            <button onClick={handleToggleExpand}>
                                <h2 className="text-[8.5pt]  font-bold opacity-90">Catalog</h2>
                            </button>
                        )}
                        <Link href="/cart" className="relative text-right flex items-end gap-2">
                            <span className="inline-flex items-end text-right min-w-[20px] text-[9pt] font-bold tabular-nums">
                                {displayNumber}{cursor}
                            </span>
                        </Link>
                    </div>

                    {/* Search Breadcrumb Strip */}
                    {isDesktopSearchMode && (
                        <div className="-mx-[calc(5vw+16px)] -mr-[2vw] bg-[#FCFDF0] px-[calc(5vw+16px)] pr-[2vw] py-4 text-[9pt] z-10">
                            {isSearchOpen ? (
                                <form
                                    className="flex items-center gap-2"
                                    onSubmit={(e) => {
                                        e.preventDefault()
                                        submitSearch()
                                    }}
                                >
                                    <span aria-hidden className="font-bold">▸</span>
                                    <input
                                        autoFocus
                                        className="bg-transparent text-[9pt] outline-none z-10 w-full"
                                        value={searchQuery}
                                        onChange={(e) => handleSearchChange(e.target.value)}
                                        onBlur={handleSearchBlur}
                                        enterKeyHint="search"
                                        autoCapitalize="none"
                                        autoCorrect="off"
                                        spellCheck={false}
                                        placeholder=""
                                    />
                                </form>
                            ) : (
                                <button onClick={editSearch} className="hover:underline">▸ {searchQuery}</button>
                            )}
                        </div>
                    )}

                    {/* Expanded Content */}
                    <AnimatePresence>
                        {showMainContentDesktop && (
                            <motion.div
                                initial={false}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="flex flex-col gap-3 overflow-hidden"
                            >
                                {!isDesktopSearchMode && (
                                    <div className="flex flex-col gap-3 text-[9pt] z-10">
                                        {(navConfig?.showSample ?? true) && (
                                            <Link href="/sample" className="hover:underline">Sample</Link>
                                        )}
                                        {(navConfig?.showSearch ?? true) && (
                                            <button onClick={() => setIsSearchOpen(!isSearchOpen)} className="text-left hover:underline">Search</button>
                                        )}
                                        {navConfig?.groups?.map((g) => (
                                            <Link
                                                key={g.id}
                                                href={`/?group=${g.slug}`}
                                                className="hover:underline"
                                            >
                                                {g.name}
                                            </Link>
                                        ))}
                                    </div>
                                )}

                                {isSearchOpen && (
                                    <form
                                        className="flex items-center gap-2"
                                        onSubmit={(e) => {
                                            e.preventDefault()
                                            submitSearch()
                                        }}
                                    >
                                        <input
                                            autoFocus
                                            className="bg-transparent text-[9pt] outline-none z-10 w-full min-w-0"
                                            value={searchQuery}
                                            onChange={(e) => handleSearchChange(e.target.value)}
                                            onBlur={handleSearchBlur}
                                            enterKeyHint="search"
                                            autoCapitalize="none"
                                            autoCorrect="off"
                                            spellCheck={false}
                                            placeholder=""
                                        />
                                    </form>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </>
    )
}
