/**
 * Shared chrome for every customer email.
 *
 * Deliberately plain: inline styles only, no external CSS, no web fonts, no
 * images. Mail clients strip <style> blocks, rewrite classes and block remote
 * assets by default, so anything cleverer degrades into something worse than
 * this.
 */

export function formatMoney(amount: number): string {
    // The store shows bare numbers, which reads fine beside a product but is
    // ambiguous in an inbox next to a total the customer was charged.
    return `$${amount.toFixed(2)}`
}

export function escapeHtml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
}

const BODY = 'margin:0;padding:0;background:#ffffff;'
const WRAP =
    'max-width:560px;margin:0 auto;padding:40px 24px;' +
    "font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;" +
    'font-size:14px;line-height:1.5;color:#000000;'

export const LABEL =
    'font-size:11px;font-weight:700;text-transform:uppercase;' +
    'letter-spacing:0.04em;color:#000000;margin:0 0 6px;'
export const MUTED = 'font-size:12px;color:#666666;margin:0;'
export const RULE = 'border:0;border-top:1px solid #000000;margin:24px 0;'
export const HAIRLINE = 'border:0;border-top:1px solid #e5e5e5;margin:16px 0;'

export function emailShell(opts: { title: string; heading: string; body: string }): string {
    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light only">
<title>${escapeHtml(opts.title)}</title>
</head>
<body style="${BODY}">
<div style="${WRAP}">
<p style="${LABEL}">Grand-Cord</p>
<hr style="${RULE}">
<h1 style="font-size:20px;font-weight:700;margin:0 0 16px;">${escapeHtml(opts.heading)}</h1>
${opts.body}
<hr style="${RULE}">
<p style="${MUTED}">All orders are shipped from Chicago.</p>
</div>
</body>
</html>`
}
