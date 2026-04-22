'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useRef, useCallback } from 'react'

type AdminNavProps = {
    active: 'orders' | 'inventory' | 'catalog' | 'more' | 'pick'
    variant?: 'centered' | 'top-left'
    pickUrgency?: string | null
}

const   NAV_ITEMS = [
    { key: 'orders' as const, label: 'Orders', href: '/admin/orders' },
    { key: 'pick' as const, label: 'Pick', href: '/admin/pick' },
    { key: 'inventory' as const, label: 'Inventory', href: '/admin/products' },
    { key: 'catalog' as const, label: 'Catalog', href: '/' },
]

type AnimState = {
    fromX: number
    fromY: number
    toX: number
    toY: number
    fading: boolean
    activeKey: string
}

function MobileHubNav({ active, pickUrgency }: { active: AdminNavProps['active']; pickUrgency?: string | null }) {
    const router = useRouter()
    const [anim, setAnim] = useState<AnimState | null>(null)
    const labelRefs = useRef<(HTMLSpanElement | null)[]>([])
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    const handlePress = useCallback((e: React.PointerEvent, index: number) => {
        const item = NAV_ITEMS[index]
        const labelEl = labelRefs.current[index]
        if (!labelEl) return

        const rect = labelEl.getBoundingClientRect()
        const labelX = rect.left + rect.width / 2
        const labelY = rect.top + rect.height / 2

        const dx = labelX - e.clientX
        const dy = labelY - e.clientY
        const dist = Math.sqrt(dx * dx + dy * dy)
        const toX = dist > 20 ? labelX - (dx / dist) * 20 : e.clientX
        const toY = dist > 20 ? labelY - (dy / dist) * 20 : e.clientY

        if (timerRef.current) clearTimeout(timerRef.current)

        setAnim({
            fromX: e.clientX,
            fromY: e.clientY,
            toX,
            toY,
            fading: false,
            activeKey: item.key,
        })

        timerRef.current = setTimeout(() => {
            setAnim(prev => prev ? { ...prev, fading: true } : null)
            setTimeout(() => {
                router.push(item.href)
                setAnim(null)
            }, 150)
        }, 400)
    }, [router])

    return (
        <>
            {anim && (
                <svg
                    className="fixed inset-0 w-full h-full pointer-events-none z-[500]"
                    style={{ opacity: anim.fading ? 0 : 1, transition: 'opacity 0.15s ease-out' }}
                >
                    <line
                        x1={anim.fromX}
                        y1={anim.fromY}
                        x2={anim.toX}
                        y2={anim.toY}
                        stroke="black"
                        strokeWidth="1.5"
                    />
                </svg>
            )}
            <div className="fixed inset-0 flex z-[200]">
                {NAV_ITEMS.map((item, i) => (
                    <div
                        key={item.key}
                        className="flex-1 flex items-center justify-center cursor-pointer select-none"
                        onPointerDown={(e) => handlePress(e, i)}
                    >
                        <span
                            ref={el => { labelRefs.current[i] = el }}
                            className={`text-[8pt] font-bold inline-flex items-center gap-[5px] ${
                                active === item.key || anim?.activeKey === item.key
                                    ? 'underline decoration-2 underline-offset-3'
                                    : ''
                            }`}
                        >
                            {item.label}
                            {item.key === 'pick' && pickUrgency && (
                                <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', backgroundColor: pickUrgency, flexShrink: 0 }} />
                            )}
                        </span>
                    </div>
                ))}
            </div>
        </>
    )
}

function MobileTopNav({ active, pickUrgency }: { active: AdminNavProps['active']; pickUrgency?: string | null }) {
    const router = useRouter()
    const [anim, setAnim] = useState<AnimState | null>(null)
    const labelRefs = useRef<(HTMLSpanElement | null)[]>([])
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    const handlePress = useCallback((e: React.PointerEvent, index: number) => {
        const item = NAV_ITEMS[index]
        const labelEl = labelRefs.current[index]
        if (!labelEl) return

        const rect = labelEl.getBoundingClientRect()
        const labelX = rect.left + rect.width / 2
        const labelY = rect.top + rect.height / 2

        const dx = labelX - e.clientX
        const dy = labelY - e.clientY
        const dist = Math.sqrt(dx * dx + dy * dy)
        const toX = dist > 20 ? labelX - (dx / dist) * 20 : e.clientX
        const toY = dist > 20 ? labelY - (dy / dist) * 20 : e.clientY

        if (timerRef.current) clearTimeout(timerRef.current)

        setAnim({ fromX: e.clientX, fromY: e.clientY, toX, toY, fading: false, activeKey: item.key })

        timerRef.current = setTimeout(() => {
            setAnim(prev => prev ? { ...prev, fading: true } : null)
            setTimeout(() => {
                router.push(item.href)
                setAnim(null)
            }, 150)
        }, 400)
    }, [router])

    return (
        <div className="sticky top-0 left-0 right-0 h-[60px] flex z-[200] bg-white">
            {anim && (
                <svg
                    className="absolute inset-0 w-full h-full pointer-events-none z-[10]"
                    style={{ opacity: anim.fading ? 0 : 1, transition: 'opacity 0.15s ease-out' }}
                >
                    <line
                        x1={anim.fromX} y1={anim.fromY}
                        x2={anim.toX} y2={anim.toY}
                        stroke="black" strokeWidth="1.5"
                    />
                </svg>
            )}
            {NAV_ITEMS.map((item, i) => (
                <div
                    key={item.key}
                    className="flex-1 flex items-center justify-center cursor-pointer select-none"
                    onPointerDown={(e) => handlePress(e, i)}
                >
                    <span
                        ref={el => { labelRefs.current[i] = el }}
                        className={`text-[8pt] font-bold inline-flex items-center gap-[5px] ${
                            active === item.key || anim?.activeKey === item.key
                                ? 'underline decoration-2 underline-offset-3'
                                : ''
                        }`}
                    >
                        {item.label}
                        {item.key === 'pick' && pickUrgency && (
                            <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', backgroundColor: pickUrgency, flexShrink: 0 }} />
                        )}
                    </span>
                </div>
            ))}
        </div>
    )
}

export function AdminNav({ active, variant = 'top-left', pickUrgency }: AdminNavProps) {
    if (variant === 'top-left') {
        return (
            <>
                <div className="md:hidden">
                    <MobileHubNav active={active} pickUrgency={pickUrgency} />
                </div>
                <div className="hidden md:flex absolute top-3 left-3 z-[300] items-start text-[8pt] font-bold gap-4">
                    {NAV_ITEMS.map(item => (
                        <Link
                            key={item.key}
                            href={item.href}
                            className={`inline-flex items-center gap-[5px] ${active === item.key ? 'underline decoration-2 underline-offset-3' : 'hover:underline hover:decoration-2 hover:underline-offset-3'}`}
                        >
                            {item.label}
                            {item.key === 'pick' && pickUrgency && (
                                <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', backgroundColor: pickUrgency, flexShrink: 0 }} />
                            )}
                        </Link>
                    ))}
                </div>
            </>
        )
    }

    return (
        <>
            <div className="md:hidden">
                <MobileTopNav active={active} pickUrgency={pickUrgency} />
            </div>
            <div className="hidden md:flex items-start text-[8pt] font-bold justify-center gap-8 py-6">
                {NAV_ITEMS.map(item => (
                    <Link
                        key={item.key}
                        href={item.href}
                        className={`inline-flex items-center gap-[5px] ${active === item.key ? 'underline decoration-2 underline-offset-3' : 'hover:underline hover:decoration-2 hover:underline-offset-3'}`}
                    >
                        {item.label}
                        {item.key === 'pick' && pickUrgency && (
                            <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', backgroundColor: pickUrgency, flexShrink: 0 }} />
                        )}
                    </Link>
                ))}
            </div>
        </>
    )
}
