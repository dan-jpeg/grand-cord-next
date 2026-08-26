/**
 * Helpers for the --app-zoom design-width scaling (see app/globals.css and the
 * inline script in app/layout.tsx).
 *
 * Because <body> carries `zoom: var(--app-zoom)`, the page has TWO coordinate
 * spaces on desktop, and mixing them silently misplaces things:
 *
 *   screen px  - getBoundingClientRect(), event.clientX/clientY,
 *                window.innerWidth/innerHeight. Already multiplied by the zoom.
 *   layout px  - offsetWidth/offsetHeight, clientWidth/clientHeight, every CSS
 *                length you write, and SVG user units inside <body>.
 *
 * At zoom 0.84 an element authored 1000px tall reports offsetHeight 1000 but
 * getBoundingClientRect().height 840. So any value measured in screen px must
 * be converted before it is written back out as a CSS length or SVG
 * coordinate. On mobile and on displays at least as wide as the design width
 * the zoom is 1 and all of this is a no-op.
 */

let cached: number | null = null
let bound = false

/**
 * Current --app-zoom factor. Cached because it is read during scroll in a
 * couple of places; the cache is dropped on resize, where the script that owns
 * the variable recomputes it.
 */
export function getAppZoom(): number {
    if (typeof window === 'undefined') return 1
    if (!bound) {
        bound = true
        window.addEventListener('resize', () => { cached = null }, { passive: true })
    }
    if (cached === null) {
        // Read from <body>, not <html>: body is where the zoom actually applies and
        // where the per-page opt-out (body:has([data-app-zoom='off'])) lands, so this
        // returns 1 on an opted-out page. Body inherits <html>'s value otherwise.
        const v = parseFloat(
            getComputedStyle(document.body).getPropertyValue('--app-zoom'),
        )
        cached = Number.isFinite(v) && v > 0 ? v : 1
    }
    return cached
}

/** Convert a screen-px measurement into layout px. */
export function toLayoutPx(screenPx: number): number {
    return screenPx / getAppZoom()
}

/** Viewport size in layout px — the space offsetWidth/offsetHeight live in. */
export function layoutViewport(): { width: number; height: number } {
    const z = getAppZoom()
    return { width: window.innerWidth / z, height: window.innerHeight / z }
}

/**
 * Origin of the fixed-positioning containing block, in screen px.
 *
 * Normally `position: fixed` resolves against the viewport and this is (0,0).
 * Under /admin it often isn't: the letterbox frame carries a transform (see the
 * .admin-frame block in app/globals.css), and a transformed ancestor becomes the
 * containing block for its fixed descendants — so a `fixed inset-0` overlay
 * starts at the frame's top-left, not the screen's.
 *
 * This is a THIRD coordinate space on top of the screen/layout px split above.
 * clientX/clientY and getBoundingClientRect() stay screen-relative regardless,
 * so any absolute coordinate drawn into such an overlay has to have this
 * subtracted first or it lands offset by the width of the letterbox gutters.
 * Differences between two client rects are already offset-invariant and need
 * nothing — this is only for coordinates used on their own.
 *
 * Keyed off the computed transform rather than a width breakpoint, so it
 * returns (0,0) by itself whenever the frame is inactive and never has to
 * restate the media query.
 */
export function fixedOrigin(): { x: number; y: number } {
    if (typeof document === 'undefined') return { x: 0, y: 0 }
    const frame = document.querySelector('.admin-frame')
    if (!frame) return { x: 0, y: 0 }
    if (getComputedStyle(frame).transform === 'none') return { x: 0, y: 0 }
    const r = frame.getBoundingClientRect()
    return { x: r.left, y: r.top }
}
