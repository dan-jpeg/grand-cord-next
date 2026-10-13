import type { CSSProperties } from 'react'
import Image from 'next/image'
import clsx from 'clsx'
import styles from './invite.module.css'
import { ScaleDebug } from './scale-debug'

// Artboard widths in design pixels. Everything below is laid out in these units
// and scales with the viewport width (see invite.module.css).
const DESKTOP_WIDTH = 1440
const MOBILE_WIDTH = 393 // iPhone 15
const BREAKPOINT = 768 // keep in sync with the media query in invite.module.css

type Unit = (n: number) => string

// One artboard pixel (scales with the viewport) and one real pixel (fixed).
const u: Unit = n => `calc(${n} * var(--u))`
const px: Unit = n => `${n}px`

// Absolute box on the artboard. Scales by default; pass `px` to pin it.
const box = (left: number, top: number, width?: number, height?: number, unit: Unit = u): CSSProperties => ({
    left: unit(left),
    top: unit(top),
    width: width === undefined ? undefined : unit(width),
    height: height === undefined ? undefined : unit(height),
})

const type = (size: number, unit: Unit = u): CSSProperties => ({ fontSize: unit(size) })

// Title row is Inter at 550 (between Medium and SemiBold); everything else is Inter Regular.
const MEDIUM: CSSProperties = { fontWeight: 550 }

const HERO = '/invite/invite-hero.jpg'

// Cream bands pinned to the top of the viewport.
// Desktop has a 50px half-strength strip at the very top; mobile mirrors it
// with a 20px white gap above its solid band.
const DESKTOP_BAND_HEIGHT = 42
const HEADER_HEIGHT = 206 // desktop: space above the photo, fixed px
const MOBILE_BAND_TOP = 20
const MOBILE_BAND_HEIGHT = 300

function Desktop() {
    // Only the photo scales on desktop. The text, the top strip and the photo's
    // top edge stay at fixed pixel sizes so the text never shrinks or collides.
    const t = type(8.5, px)
    const at = (left: number, top: number, width?: number) => box(left, top, width, undefined, px)

    return (
        <div className={clsx(styles.artboard, styles.desktop)} style={{ height: `calc(${HEADER_HEIGHT}px + ${u(810)})` }}>
            <p className={styles.text} style={{ ...at(158, 78), ...t, ...MEDIUM }}>
                Chicago&nbsp;&nbsp;&nbsp;November 20-21
            </p>
            <p className={styles.text} style={{ ...at(365, 78), ...t, ...MEDIUM }}>
                1684 N Ada St
            </p>

            <p className={styles.text} style={{ ...at(158, 118), ...t }}>
                Friday Nov 20th<br />Saturday Nov 21st
            </p>
            <p className={styles.text} style={{ ...at(254, 118, 78), ...t, textAlign: 'right' }}>
                11am-9pm<br />11am-7pm
            </p>
            <p className={styles.text} style={{ ...at(344, 118), ...t }}>
                /
            </p>
            <p className={styles.text} style={{ ...at(360, 118), ...t }}>
                Live performances from 9pm
            </p>

            {/* Full width, so its height tracks the viewport width. */}
            <div style={{ left: 0, top: px(HEADER_HEIGHT), width: '100%', height: u(810) }}>
                <Image src={HERO} alt="" fill priority sizes="100vw" className={styles.image} />
            </div>

            <div className={styles.band} style={{ left: 0, top: 0, width: '100%', height: px(DESKTOP_BAND_HEIGHT), opacity: 0.5 }} />
        </div>
    )
}

function Mobile() {
    // Measured from the mobile mockup (1048px wide, scaled to the 393 artboard).
    const t = type(7)

    return (
        <div className={clsx(styles.artboard, styles.mobile)} style={{ height: u(852) }}>
            <div className={styles.band} style={box(0, MOBILE_BAND_TOP, MOBILE_WIDTH, MOBILE_BAND_HEIGHT)} />

            <p className={styles.text} style={{ ...box(41.25, 78), ...t, ...MEDIUM }}>
                Chicago&nbsp;&nbsp;&nbsp;November 20-21
            </p>
            <p className={styles.text} style={{ ...box(212.6, 78), ...t, ...MEDIUM }}>
                1684 N Ada St
            </p>

            <p className={styles.text} style={{ ...box(41.25, 111.4), ...t }}>
                Friday Nov 20th<br />Saturday Nov 21st
            </p>
            <p className={styles.text} style={{ ...box(143.4, 111.4, 40), ...t, textAlign: 'right' }}>
                5pm-9pm<br />11am-7pm
            </p>
            <p className={styles.text} style={{ ...box(194.6, 111.4), ...t }}>
                /
            </p>
            <p className={styles.text} style={{ ...box(208.9, 111.4), ...t }}>
                Live performances from 9pm
            </p>
        </div>
    )
}

export default async function InvitePage({ searchParams }: {
    searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
    const { debug } = await searchParams

    return (
        <main className={styles.stage} data-app-zoom="off">
            <Desktop />
            <Mobile />
            {debug !== undefined && (
                <ScaleDebug breakpoint={BREAKPOINT} desktopWidth={DESKTOP_WIDTH} mobileWidth={MOBILE_WIDTH} />
            )}
        </main>
    )
}
