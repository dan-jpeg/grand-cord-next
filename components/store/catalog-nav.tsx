'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { useCart } from '@/contexts/cart-context'

type CatalogNavProps = {
    productCount: number
    onSearchChange?: (query: string) => void
    mobileLayout?: '1x1' | '2x2' | '3x3'
    onLayoutChange?: (layout: '1x1' | '2x2' | '3x3') => void
    isLocked?: boolean
}

export function CatalogNav({
                               productCount,
                               onSearchChange,
                               mobileLayout = '1x1',
                               onLayoutChange,
                               isLocked = false
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

    useEffect(() => {
        if (isDesktop) return

        const handleScroll = () => {
            const currentScrollY = window.scrollY
            const isScrollingUp = currentScrollY < lastScrollY

            // Keep nav closed and stable while showing mobile search results.
            if (isMobileSearchLocked) {
                setShowLayout(false)
                setIsExpanded(false)
                wasLockedRef.current = isLocked
                setLastScrollY(currentScrollY)
                return
            }

            // If manually opened while at top (isLocked), keep it open
            if (manuallyOpenedRef.current && isLocked) {
                setLastScrollY(currentScrollY)
                return
            }

            // Reset manual flag if we scroll down past threshold
            if (!isLocked) {
                manuallyOpenedRef.current = false
            }

            // Only show if locked, scrolling up, AND was previously locked
            if (isLocked && isScrollingUp && wasLockedRef.current) {
                setShowLayout(true)
                setIsExpanded(true)
            } else {
                setShowLayout(false)
                setIsExpanded(false)
            }

            wasLockedRef.current = isLocked
            setLastScrollY(currentScrollY)
        }

        window.addEventListener('scroll', handleScroll, { passive: true })
        return () => window.removeEventListener('scroll', handleScroll)
    }, [lastScrollY, isDesktop, isLocked, isMobileSearchLocked])

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
        if (!isDesktop) {
            // Re-open full catalog controls only when user explicitly taps Catalog.
            if (isMobileSearchLocked) {
                setIsMobileSearchLocked(false)
            }
            const newExpandedState = !isExpanded
            setIsExpanded(newExpandedState)

            // Track if user manually opened it while at top
            if (newExpandedState && isLocked) {
                manuallyOpenedRef.current = true
            } else {
                manuallyOpenedRef.current = false
            }
        }
    }

    const handleSearchChange = (v: string) => {
        setSearchQuery(v)
        onSearchChange?.(v)
        if (!isDesktop && v.trim()) setIsMobileSearchLocked(true)
    }
    const handleSearchBlur = () => {
        if (isDesktop) {
            setIsSearchOpen(false)
            return
        }
        if (searchQuery.trim()) {
            setIsSearchOpen(false)
            setIsExpanded(false)
            setIsMobileSearchLocked(true)
        }
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
    const showingBreadcrumb = !isSearchOpen && searchQuery
    const isDesktopSearchMode = isDesktop && !!searchQuery.trim()
    const showMainContent = isDesktop
        ? !isDesktopSearchMode
        : isExpanded || (!isDesktop && isMobileSearchLocked && isSearchOpen)

    return (
        <div
            ref={navRef}
            className={`bg-transparent lg:bg-white w-full ${isDesktopSearchMode ? 'min-h-0' : 'min-h-[120px]'}`}
            data-catalog-nav
        >
            <div className={`flex flex-col pl-4 pr-10 lg:pr-[2vw] lg:pl-[calc(5vw+0px)] pt-6 relative transition-all ${
                isDesktop && isStuck && !isDesktopSearchMode ? 'lg:border-b-[0.5px]' : ''
            } ${isDesktopSearchMode ? 'gap-0 pb-0' : 'gap-3 pb-6'}`}>
                {/* Header Row */}
                <div className="flex items-center justify-between relative z-10 w-full">
                    <button onClick={handleToggleExpand}>
                        <h2 className="text-[9pt] font-bold">Catalog</h2>
                    </button>
                    <Link href="/cart" className="relative text-right flex items-end gap-2">
                        <span className="inline-flex items-end text-right min-w-[20px] text-[9pt] font-bold tabular-nums">
                            {displayNumber}{cursor}
                        </span>
                    </Link>
                </div>

                {/* Mobile Search Breadcrumb */}
                {!isDesktop && showingBreadcrumb && !isExpanded && (
                    <div className="-ml-4 -mr-10 pl-4 pr-10 py-2 bg-[#FCFDF0] z-10">
                        <button onClick={editSearch} className="text-[9pt] font-bold text-left">▸ {searchQuery}</button>
                    </div>
                )}

                {/* Desktop Search Breadcrumb Strip */}
                {isDesktop && isDesktopSearchMode && (
                    <div className="-mx-[calc(5vw+16px)] -mr-[2vw] bg-[#FCFDF0] px-[calc(5vw+16px)] pr-[2vw] py-2 text-[9pt] z-10">
                        {isSearchOpen ? (
                            <div className="flex items-center gap-2">
                                <span aria-hidden className="font-bold">▸</span>
                                <input
                                    autoFocus
                                    className="bg-transparent text-[9pt] outline-none z-10 w-full"
                                    value={searchQuery}
                                    onChange={(e) => handleSearchChange(e.target.value)}
                                    onBlur={handleSearchBlur}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            ;(e.currentTarget as HTMLInputElement).blur()
                                        }
                                    }}
                                    placeholder=""
                                />
                            </div>
                        ) : (
                            <button onClick={editSearch} className="hover:underline">▸ {searchQuery}</button>
                        )}
                    </div>
                )}

                {/* Main Content Area */}
                <AnimatePresence>
                    {showMainContent && (
                        <motion.div
                            initial={isDesktop ? false : { opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={!isDesktop ? { duration: 0 } : undefined}
                            className={`flex flex-col gap-3 ${
                                !isDesktop && isSearchOpen ? 'overflow-visible' : 'overflow-hidden'
                            }`}
                        >
                            {(!isMobileSearchLocked || isDesktop) && !isDesktopSearchMode && (
                                <div className="flex flex-col gap-3 text-[9pt] z-10">
                                    <Link href="/sample" className="hover:underline">Sample</Link>
                                    <button onClick={() => setIsSearchOpen(!isSearchOpen)} className="text-left hover:underline">Search</button>
                                </div>
                            )}

                            {isSearchOpen && (
                                <div
                                    className={`flex items-center gap-2 ${
                                        !isDesktop ? '-ml-4 -mr-10 pl-4 pr-10 py-2 bg-[#FCFDF0]' : ''
                                    }`}
                                >
                                    {isMobileSearchLocked && !isDesktop && (
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
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                ;(e.currentTarget as HTMLInputElement).blur()
                                            }
                                        }}
                                        placeholder=""
                                    />
                                </div>
                            )}

                            {!isDesktop && showingBreadcrumb && (
                                <div className="text-[9pt] z-10">
                                    <button onClick={editSearch} className="hover:underline">▸ {searchQuery}</button>
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Layout Switcher */}
                <AnimatePresence>
                    {showLayout && !isDesktop && !isMobileSearchLocked && !isSearchOpen && (
                        <motion.div
                            ref={layoutRef}
                            initial={{ opacity: 0, y: -40 }}
                            animate={{ opacity: layoutOpacity, y: 0 }}
                            exit={{ opacity: 0, y: -40 }}
                            transition={{ duration: 0.17 }}
                            className="absolute left-0 right-0 top-full -mt-2 pt-4 pb-4 grid grid-cols-[auto_1fr_auto] bg-white items-center text-[9pt] px-4 md:px-8"
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
    )
}
