'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useRef, useCallback, useEffect } from 'react'
import { signOut } from 'next-auth/react'

function handleLogout() {
    signOut({ callbackUrl: '/admin/login' })
}

type AdminNavProps = {
    active: 'orders' | 'inventory' | 'catalog' | 'manage-catalog' | 'more' | 'pick' | 'logs' | 'members'
    variant?: 'centered' | 'top-left'
    /**
     * Mobile presentation:
     *  - 'eye' (default): compact eye icon in top-left; tap to open the fullscreen hub nav
     *  - 'hub': fullscreen hub nav always visible (used by the /admin index page)
     */
    mobileVariant?: 'eye' | 'hub'
    /**
     * Optional short label rendered next to the mobile eye icon (e.g. "Inventory",
     * "Orders"). Tapping the label opens the hub, same as the eye.
     */
    mobileLabel?: string
    pickUrgency?: string | null
    topClass?: string
    leftClass?: string
}

const PRIMARY_NAV_ITEMS = [
    { key: 'orders' as const, label: 'Orders', href: '/admin/orders' },
    { key: 'pick' as const, label: 'Pick', href: '/admin/pick' },
    { key: 'inventory' as const, label: 'Inventory', href: '/admin/products-new' },
]

const MORE_ITEMS = [
    { key: 'logs' as const, label: 'Logs', href: '/admin/logs' },
    { key: 'members' as const, label: 'Members', href: '/admin/members' },
    { key: 'manage-catalog' as const, label: 'Manage Catalog', href: '/admin/manage-catalog' },
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

function MobileHubNav({ active, pickUrgency, onClose }: { active: AdminNavProps['active']; pickUrgency?: string | null; onClose?: () => void }) {
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
            <div className="fixed inset-0 flex z-[200] bg-white">
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

function MobileEyeHub({ active, pickUrgency, label }: { active: AdminNavProps['active']; pickUrgency?: string | null; label?: string }) {
    // Two-phase open/close so the hub can fade in/out cleanly:
    // `mounted` decides whether it lives in the tree at all; `visible` drives
    // the opacity class. On close we flip visible first, then unmount after
    // the transition completes.
    const [mounted, setMounted] = useState(false)
    const [visible, setVisible] = useState(false)

    const toggle = useCallback(() => {
        if (mounted && visible) {
            setVisible(false)
            setTimeout(() => setMounted(false), 180)
        } else {
            setMounted(true)
            requestAnimationFrame(() => setVisible(true))
        }
    }, [mounted, visible])

    const close = useCallback(() => {
        setVisible(false)
        setTimeout(() => setMounted(false), 180)
    }, [])

    return (
        <>
            <button
                type="button"
                aria-label={visible ? 'Close menu' : 'Open menu'}
                onClick={toggle}
                className="fixed top-[7px] left-[11px] z-[400] p-2 flex items-center gap-2"
            >
                <Image src="/eye.svg" alt="" width={20} height={10} priority />
                {label && (
                    <>
                        <span className="text-[12px] font-bold leading-none opacity-40">—</span>
                        <span className="text-[12px] font-bold leading-none">{label}</span>
                    </>
                )}
            </button>
            {mounted && (
                <div
                    className={`fixed inset-0 z-[200] transition-opacity duration-200 ease-out ${
                        visible ? 'opacity-100' : 'opacity-0'
                    }`}
                >
                    <MobileHubNav active={active} pickUrgency={pickUrgency} onClose={close} />
                </div>
            )}
        </>
    )
}

export function AdminNav({ active, variant = 'top-left', mobileVariant = 'eye', mobileLabel, pickUrgency, topClass = 'top-3', leftClass = 'left-3' }: AdminNavProps) {
    const mobile = mobileVariant === 'hub'
        ? <MobileHubNav active={active} pickUrgency={pickUrgency} />
        : <MobileEyeHub active={active} pickUrgency={pickUrgency} label={mobileLabel} />

    if (variant === 'top-left') {
        return (
            <>
                <div className="lg:hidden">
                    {mobile}
                </div>
                <div className={`hidden lg:flex absolute ${topClass} ${leftClass} z-[300] items-start text-[8pt] font-bold gap-4`}>
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
            <div className="lg:hidden">
                {mobile}
            </div>
            <div className="hidden lg:flex absolute top-3 left-3 z-[300] items-start text-[8pt] font-bold gap-4">
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
