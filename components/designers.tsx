import { normalizeDesignerNames } from '@/lib/designers'

type DesignersProps = {
    designerNames: string[] | null | undefined
    /**
     * Space between designer names. A number is treated as px, a string is
     * used as-is so callers can pass any CSS length (`'0.5em'`, `'2ch'`,
     * `'calc(1*var(--vw))'`, …).
     */
    gap?: number | string
    /** Keep every name on one line instead of wrapping. */
    nowrap?: boolean
    className?: string
}

/**
 * Designer names with no separator — spacing between them is the separator,
 * and the caller controls how much of it there is.
 */
export function Designers({
    designerNames,
    gap = '1ch',
    nowrap = false,
    className = '',
}: DesignersProps) {
    const names = normalizeDesignerNames(designerNames)
    if (names.length === 0) return null

    return (
        <span
            className={`inline-flex ${nowrap ? 'flex-nowrap whitespace-nowrap' : 'flex-wrap'} ${className}`}
            style={{ columnGap: typeof gap === 'number' ? `${gap}px` : gap, rowGap: '0.25em' }}
        >
            {names.map((name, i) => (
                <span key={`${name}-${i}`}>{name}</span>
            ))}
        </span>
    )
}

type DesignersWithCommaProps = {
    designerNames: string[] | null | undefined
    className?: string
}

/**
 * Comma-separated designer names — the rendered equivalent of
 * `formatDesignerNames`.
 */
export function DesignersWithComma({
    designerNames,
    className = '',
}: DesignersWithCommaProps) {
    const names = normalizeDesignerNames(designerNames)
    if (names.length === 0) return null

    return <span className={className}>{names.join(', ')}</span>
}
