'use client'

import { useLayoutEffect, useRef, useState } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import { CatalogNav } from '@/components/store/catalog-nav'

type CatalogNavWrapperProps = {
    productCount: number
    onSearchChange?: (query: string) => void
    mobileLayout?: '1x1' | '2x2' | '3x3'
    onLayoutChange?: (layout: '1x1' | '2x2' | '3x3') => void
}

export function CatalogNavWrapper(props: CatalogNavWrapperProps) {
    const releaseRef = useRef<HTMLDivElement>(null)
    const measureRef = useRef<HTMLDivElement>(null)

    const [navHeight, setNavHeight] = useState(0)
    const [vh, setVh] = useState(0)
    const [isGrowing, setIsGrowing] = useState(true)
    const [isLocked, setIsLocked] = useState(false)

    useLayoutEffect(() => {
        const measureNav = () => {
            if (measureRef.current) {
                setNavHeight(measureRef.current.offsetHeight)
                setVh(window.innerHeight)
            }
        }
        measureNav()
        window.addEventListener('resize', measureNav)
        return () => window.removeEventListener('resize', measureNav)
    }, [props.productCount])

    const { scrollYProgress } = useScroll({
        target: releaseRef,
        offset: ['start end', 'end start'],
    })

    const easedProgress = useTransform(scrollYProgress, p => {
        const pLimit = Math.min(p * 1.12, 1)
        return pLimit < 0.5
            ? Math.pow(pLimit * 2, 0.8) / 2
            : 0.5 + Math.pow((pLimit - 0.5) * 2, 1.2) / 2
    })

    useLayoutEffect(() => {
        return easedProgress.on('change', v => {
            setIsGrowing(v < 0.5)
            // Handshake: Tell child we are at the top
            setIsLocked(v >= 0.1)
        })
    }, [easedProgress])

    const currentSheetHeight = useTransform(easedProgress, p => {
        if (p < 0.5) {
            return navHeight + (p * 2) * (vh - navHeight)
        } else {
            return vh - ((p - 0.5) * 2) * (vh - navHeight)
        }
    })

    return (
        <>
            <div ref={measureRef} className="fixed opacity-0 pointer-events-none left-0 right-0">
                <CatalogNav {...props} />
            </div>

            <div ref={releaseRef} className="h-[200vh] pointer-events-none" />

            <motion.div
                style={{
                    height: currentSheetHeight,
                    bottom: isGrowing ? 0 : 'auto',
                    top: isGrowing ? 'auto' : 0,
                }}
                className="fixed inset-x-0 z-60 bg-[#FCFDF0] overflow-visible"
            >
                <div className="w-full h-full relative">
                    <CatalogNav
                        {...props}
                        isLocked={isLocked}
                    />
                </div>
            </motion.div>
        </>
    )
}