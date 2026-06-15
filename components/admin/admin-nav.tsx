'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useRef, useCallback, useEffect } from 'react'
import { signOut } from 'next-auth/react'

function handleLogout() {
    signOut({ callbackUrl: '/admin/login' })
}

type AdminNavProps = {
    active: 'orders' | 'inventory' | 'catalog' | 'more' | 'pick' | 'logs' | 'members'
    variant?: 'centered' | 'top-left'
    pickUrgency?: string | null
    topClass?: string
    leftClass?: string
}

const PRIMARY_NAV_ITEMS = [
    { key: 'orders' as const, label: 'Orders', href: '/admin/orders' },
    { key: 'pick' as const, label: 'Pick', href: '/admin/pick' },
    { key: 'inventory' as const, label: 'Inventory', href: '/admin/products' },
]

const MORE_ITEMS = [
    { key: 'logs' as const, label: 'Logs', href: '/admin/logs' },
    { key: 'members' as const, label: 'Members', href: '/admin/members' },
    { key: 'catalog' as const, label: 'Catalog', href: '/' },
]

type MoreKey = (typeof MORE_ITEMS)[number]['key']

function isMoreKey(k: AdminNavProps['active']): k is MoreKey {
    return MORE_ITEMS.some((m) => m.key === k)
}

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
    const [moreOpen, setMoreOpen] = useState(false)
    const labelRefs = useRef<(HTMLSpanElement | null)[]>([])
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    const moreActive = active === 'more' || isMoreKey(active) || moreOpen

    const handlePress = useCallback((e: React.PointerEvent, index: number) => {
        const item = PRIMARY_NAV_ITEMS[index]
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
                {PRIMARY_NAV_ITEMS.map((item, i) => (
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
                <div
                    className="flex-1 flex items-center justify-center cursor-pointer select-none"
                    onPointerDown={(e) => {
                        e.stopPropagation()
                        setMoreOpen((v) => !v)
                    }}
                >
                    {moreOpen ? (
                        <div className="flex flex-col items-center gap-[10px]">
                            {MORE_ITEMS.map((item) => (
                                <span
                                    key={item.key}
                                    onPointerDown={(e) => {
                                        e.stopPropagation()
                                        router.push(item.href)
                                    }}
                                    className={`text-[8pt] font-bold ${
                                        active === item.key
                                            ? 'underline decoration-2 underline-offset-3'
                                            : ''
                                    }`}
                                >
                                    {item.label}
                                </span>
                            ))}
                            <button
                                type="button"
                                onPointerDown={(e) => {
                                    e.stopPropagation()
                                    handleLogout()
                                }}
                                className="text-[8pt] font-bold text-neutral-400"
                            >
                                Logout
                            </button>
                        </div>
                    ) : (
                        <span
                            className={`text-[8pt] font-bold ${
                                moreActive ? 'underline decoration-2 underline-offset-3' : ''
                            }`}
                        >
                            More
                        </span>
                    )}
                </div>
            </div>
        </>
    )
}

function MobileTopNav({ active, pickUrgency }: { active: AdminNavProps['active']; pickUrgency?: string | null }) {
    const router = useRouter()
    const [anim, setAnim] = useState<AnimState | null>(null)
    const [moreOpen, setMoreOpen] = useState(false)
    const labelRefs = useRef<(HTMLSpanElement | null)[]>([])
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    const moreActive = active === 'more' || isMoreKey(active) || moreOpen

    const handlePress = useCallback((e: React.PointerEvent, index: number) => {
        const item = PRIMARY_NAV_ITEMS[index]
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
            {PRIMARY_NAV_ITEMS.map((item, i) => (
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
            <div
                className="flex-1 flex items-center justify-center cursor-pointer select-none relative"
                onPointerDown={(e) => {
                    e.stopPropagation()
                    setMoreOpen((v) => !v)
                }}
            >
                <span
                    className={`text-[8pt] font-bold ${
                        moreActive ? 'underline decoration-2 underline-offset-3' : ''
                    }`}
                >
                    More
                </span>
                {moreOpen && (
                    <div className="absolute top-full left-0 right-0 bg-white border-t border-neutral-100 flex flex-col items-center py-3 gap-[10px] z-[201]">
                        {MORE_ITEMS.map((item) => (
                            <span
                                key={item.key}
                                onPointerDown={(e) => {
                                    e.stopPropagation()
                                    router.push(item.href)
                                }}
                                className={`text-[8pt] font-bold ${
                                    active === item.key
                                        ? 'underline decoration-2 underline-offset-3'
                                        : ''
                                }`}
                            >
                                {item.label}
                            </span>
                        ))}
                        <button
                            type="button"
                            onPointerDown={(e) => {
                                e.stopPropagation()
                                handleLogout()
                            }}
                            className="text-[8pt] font-bold text-neutral-400"
                        >
                            Logout
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}

function DesktopMoreMenu({
    active,
    align = 'left',
}: {
    active: AdminNavProps['active']
    align?: 'left' | 'center'
}) {
    const [open, setOpen] = useState(false)
    const wrapRef = useRef<HTMLDivElement | null>(null)

    const moreActive = active === 'more' || isMoreKey(active) || open

    useEffect(() => {
        if (!open) return
        function onDown(e: MouseEvent) {
            if (!wrapRef.current) return
            if (!wrapRef.current.contains(e.target as Node)) {
                setOpen(false)
            }
        }
        document.addEventListener('mousedown', onDown)
        return () => document.removeEventListener('mousedown', onDown)
    }, [open])

    return (
        <div ref={wrapRef} className="relative">
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className={`inline-flex items-center gap-[5px] ${
                    moreActive
                        ? 'underline decoration-2 underline-offset-3'
                        : 'hover:underline hover:decoration-2 hover:underline-offset-3'
                }`}
            >
                More
            </button>
            {open && (
                <div
                    className={`absolute top-full mt-2 bg-white border border-neutral-200 py-2 px-3 flex flex-col gap-2 z-[400] min-w-[88px] ${
                        align === 'center' ? 'left-1/2 -translate-x-1/2' : 'left-0'
                    }`}
                >
                    {MORE_ITEMS.map((item) => (
                        <Link
                            key={item.key}
                            href={item.href}
                            onClick={() => setOpen(false)}
                            className={`inline-flex items-center ${
                                active === item.key
                                    ? 'underline decoration-2 underline-offset-3'
                                    : 'hover:underline hover:decoration-2 hover:underline-offset-3'
                            }`}
                        >
                            {item.label}
                        </Link>
                    ))}
                    <button
                        type="button"
                        onClick={handleLogout}
                        className="inline-flex items-center text-left text-neutral-400 hover:text-black hover:underline hover:decoration-2 hover:underline-offset-3"
                    >
                        Logout
                    </button>
                </div>
            )}
        </div>
    )
}

export function AdminNav({ active, variant = 'top-left', pickUrgency, topClass = 'top-3', leftClass = 'left-3' }: AdminNavProps) {
    if (variant === 'top-left') {
        return (
            <>
                <div className="md:hidden">
                    <MobileHubNav active={active} pickUrgency={pickUrgency} />
                </div>
                <div className={`hidden md:flex absolute ${topClass} ${leftClass} z-[300] items-start text-[8pt] font-bold gap-4`}>
                    {PRIMARY_NAV_ITEMS.map(item => (
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
                    <DesktopMoreMenu active={active} align="left" />
                </div>
            </>
        )
    }

    return (
        <>
            <div className="md:hidden">
                <MobileTopNav active={active} pickUrgency={pickUrgency} />
            </div>
            <div className="hidden md:flex absolute top-3 left-3 z-[300] items-start text-[8pt] font-bold gap-4">
                {PRIMARY_NAV_ITEMS.map(item => (
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
                <DesktopMoreMenu active={active} align="left" />
            </div>
        </>
    )
}
