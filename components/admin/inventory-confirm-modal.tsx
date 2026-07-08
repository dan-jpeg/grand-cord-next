'use client'

export type InventoryChange = {
    sizeId: string
    sizeLabel: string
    before: number
    after: number
    delta: number
    kind?: 'add' | 'remove'
}

export function InventoryConfirmModal({
    productName,
    changes,
    saving,
    onConfirm,
    onCancel,
    onDiscard,
}: {
    productName: string
    changes: InventoryChange[]
    saving: boolean
    onConfirm: () => void
    onCancel: () => void
    onDiscard: () => void
}) {
    return (
        <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-[500] flex items-center justify-center bg-black/40 px-4"
            onClick={onCancel}
        >
            <div
                className="bg-white w-full max-w-[360px] p-5 flex flex-col gap-4"
                onClick={(e) => e.stopPropagation()}
            >
                <div>
                    <p className="font-reformat text-[9px] tracking-[0.1em] uppercase text-neutral-500 mb-1">
                        Confirm inventory changes
                    </p>
                    <p className="font-alte text-[16px] leading-tight">{productName}</p>
                </div>

                <div className="bg-[#fafafa] divide-y divide-white">
                    {changes.map((c) => (
                        <div
                            key={c.sizeId}
                            className="flex items-center justify-between px-3 py-2"
                        >
                            <span className="font-reformat text-[10px] tracking-[0.1em] uppercase font-bold">
                                {c.sizeLabel}
                                {c.kind === 'add' && (
                                    <span className="ml-2 font-normal normal-case text-[#1a7a1a]">(new)</span>
                                )}
                                {c.kind === 'remove' && (
                                    <span className="ml-2 font-normal normal-case text-[#a02020]">(removed)</span>
                                )}
                            </span>
                            <span className="font-alte text-[13px] tabular-nums flex items-center gap-2">
                                <span className="text-neutral-400">{c.kind === 'add' ? '—' : c.before}</span>
                                <span className="text-neutral-400">→</span>
                                <span>{c.kind === 'remove' ? '—' : c.after}</span>
                                <span
                                    className={`font-reformat text-[10px] tracking-[0.05em] ${
                                        c.delta > 0 ? 'text-[#1a7a1a]' : 'text-[#a02020]'
                                    }`}
                                >
                                    ({c.delta > 0 ? '+' : ''}
                                    {c.delta})
                                </span>
                            </span>
                        </div>
                    ))}
                </div>

                <div className="flex items-center justify-between pt-2">
                    <button
                        type="button"
                        onClick={onDiscard}
                        disabled={saving}
                        className="text-[11px] text-neutral-400 hover:text-black underline hover:no-underline disabled:opacity-40"
                    >
                        Discard
                    </button>
                    <div className="flex items-center gap-5">
                        <button
                            type="button"
                            onClick={onCancel}
                            disabled={saving}
                            className="text-[11px] text-neutral-400 hover:text-black underline hover:no-underline disabled:opacity-40"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={onConfirm}
                            disabled={saving}
                            className="text-[12px] font-bold underline hover:no-underline disabled:opacity-40"
                        >
                            {saving ? 'Saving…' : 'Confirm'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

export function LockIcon({ unlocked }: { unlocked: boolean }) {
    return unlocked ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 9.9-1" />
        </svg>
    ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
    )
}
