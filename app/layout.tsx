import type { Metadata, Viewport } from 'next'
import './globals.css'
import { CartProvider } from '@/contexts/cart-context'

export const metadata: Metadata = {
    title: 'grand-cord',
    description: 'grand-cord studio ',
    // Stop iOS Safari's Data Detectors from auto-linking the address/phone/etc.
    // in body text (the stray dotted-underline "links" on Apple devices).
    formatDetection: { telephone: false, date: false, address: false, email: false },
}

export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
}

// Sets --app-zoom so a narrower display renders the layout as it was designed
// at 1800px logical width (macOS "More Space" on a 14" MBP). Runs as the first
// child of <body> so it executes before the page content is parsed — no flash
// of unscaled layout. See the --app-zoom block in globals.css.
const APP_ZOOM_SCRIPT = `(function(){
var DESIGN_WIDTH=1800,MIN_WIDTH=1024,r=document.documentElement;
function apply(){
var w=r.clientWidth;
r.style.setProperty('--app-zoom',String(w>=MIN_WIDTH?Math.min(1,w/DESIGN_WIDTH):1));
}
apply();
addEventListener('resize',apply,{passive:true});
// A ResizeObserver on the root catches layout-viewport changes that don't
// dispatch a resize event (some embedded/preview browsers, scrollbar changes).
if(window.ResizeObserver)new ResizeObserver(apply).observe(r);
})();`

export default function RootLayout({
                                       children,
                                   }: {
    children: React.ReactNode
}) {
    // suppressHydrationWarning: APP_ZOOM_SCRIPT sets --app-zoom as an inline
    // style on <html> before React hydrates, so the server and client attributes
    // differ by design. It is shallow — it covers only this element's own
    // attributes, not the tree below it.
    return (
        <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
        <body>
        <script dangerouslySetInnerHTML={{ __html: APP_ZOOM_SCRIPT }} />
        <CartProvider>
            {children}
        </CartProvider>
        </body>
        </html>
    )
}
