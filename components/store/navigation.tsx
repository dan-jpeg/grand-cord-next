'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { useCart } from '@/contexts/cart-context'
import Image from 'next/image'
import { usePathname } from 'next/navigation'

export function Navigation() {

    const BACKSPACE_SPEED = 300
    const TYPE_SPEED = 120
    const EMPTY_PAUSE = 190
    const POST_BLINK_PAUSE = 200
    const FINAL_HIDE_DELAY = 250

    const { totalItems } = useCart()
    const pathname = usePathname()

    const [isCartHovered, setIsCartHovered] = useState(false)
    const [isMobile, setIsMobile] = useState(false)

    const [displayNumber, setDisplayNumber] = useState('')
    const [showCursor, setShowCursor] = useState(false)
    const [cursorBlinkCount, setCursorBlinkCount] = useState(0)

    const prevTotalItems = useRef(0)

    const animationRef = useRef<{
        interval?: NodeJS.Timeout
        timeout?: NodeJS.Timeout
    }>({})

    const clearAnimation = () => {
        if (animationRef.current.interval) clearInterval(animationRef.current.interval)
        if (animationRef.current.timeout) clearTimeout(animationRef.current.timeout)
    }

    // Detect mobile
    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 1024)
        checkMobile()
        window.addEventListener('resize', checkMobile)
        return () => window.removeEventListener('resize', checkMobile)
    }, [])

    // Initialize count
    useEffect(() => {
        if (prevTotalItems.current === 0 && totalItems > 0) {
            setDisplayNumber(totalItems.toString())
            prevTotalItems.current = totalItems
        }
    }, [])

    // Typewriter animation
    useEffect(() => {
        clearAnimation()

        const oldValue = prevTotalItems.current.toString()
        const newValue = totalItems.toString()

        // Decrease or no change → snap update
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

        // BACKSPACE
        animationRef.current.interval = setInterval(() => {
            index--
            setDisplayNumber(oldValue.slice(0, Math.max(index, 0)))

            if (index <= 0) {
                clearInterval(animationRef.current.interval)

                // Pause at empty state
                animationRef.current.timeout = setTimeout(() => {
                    // TYPE
                    let typeIndex = 0
                    animationRef.current.interval = setInterval(() => {
                        typeIndex++
                        setDisplayNumber(newValue.slice(0, typeIndex))

                        if (typeIndex >= newValue.length) {
                            clearInterval(animationRef.current.interval)

                            // Post-type blink (2x)
                            animationRef.current.timeout = setTimeout(() => {
                                setCursorBlinkCount(1)
                            }, POST_BLINK_PAUSE)
                        }
                    }, TYPE_SPEED)
                }, EMPTY_PAUSE)
            }
        }, BACKSPACE_SPEED)

        prevTotalItems.current = totalItems
        return clearAnimation
    }, [totalItems])

    // Hide nav on mobile cart page OR on homepage
    if (isMobile && pathname === '/cart') return null
    if (pathname === '/') return null

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
                            setTimeout(() => {
                                setCursorBlinkCount(0)
                                setShowCursor(false)
                            }, FINAL_HIDE_DELAY)
                        }
                    }}
                    className="inline-block font-mono font-semibold w-[2.5px] h-[16px] bg-black ml-[2px]"
                />
            )}
        </AnimatePresence>
    )

    return (
        <nav className="fixed top-0 left-0 right-0 z-20">
            {/* Desktop cart moved into GlobalCatalogNav (sticky above every page). */}

            {/* Mobile */}
            <div className="flex lg:hidden mx-auto px-10 py-4 h-[64px] bg-[#FCFDF0] items-center justify-between">
                <Link href="/" className="text-[8.5pt] font-bold opacity-90">
                    Catalog
                </Link>
                <Link
                    href="/cart"
                    className="flex items-center gap-2"
                    onMouseEnter={() => setIsCartHovered(true)}
                    onMouseLeave={() => setIsCartHovered(false)}
                >
                    <span className="inline-flex items-center min-w-[16px] text-[9pt] font-bold tabular-nums">
                        {displayNumber}
                        {cursor}
                    </span>
                </Link>
            </div>
        </nav>
    )
}