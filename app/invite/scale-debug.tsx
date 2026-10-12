'use client'

import { useEffect, useState } from 'react'
import styles from './invite.module.css'

// Shows which artboard is active and its current scale. Enable with /invite?debug
export function ScaleDebug({ breakpoint, desktopWidth, mobileWidth }: {
    breakpoint: number
    desktopWidth: number
    mobileWidth: number
}) {
    const [width, setWidth] = useState<number | null>(null)

    useEffect(() => {
        const update = () => setWidth(document.documentElement.clientWidth)
        update()
        window.addEventListener('resize', update)
        return () => window.removeEventListener('resize', update)
    }, [])

    if (width === null) return null

    const isMobile = width < breakpoint
    const base = isMobile ? mobileWidth : desktopWidth

    return (
        <div className={styles.debug}>
            {isMobile ? 'mobile' : 'desktop'} {base}px · viewport {width}px · scale {(width / base).toFixed(3)}
        </div>
    )
}
