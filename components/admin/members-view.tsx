'use client'

import { useState, useTransition } from 'react'
import {
    createMember,
    deleteMember,
    resetMemberPassword,
    updateMemberName,
} from '@/app/admin/members/actions'

type Member = {
    id: string
    email: string
    name: string | null
    createdAt: Date
}

export function MembersView({
    members,
    currentUserId,
}: {
    members: Member[]
    currentUserId: string
}) {
    const [adding, setAdding] = useState(false)

    return (
        <div className="space-y-6 max-w-3xl mx-auto">
            <div className="flex items-baseline justify-between gap-4">
                <h1 className="font-alte text-[32px] leading-none tracking-[-0.02em]">
                    Members
                </h1>
                {!adding && (
                    <button
                        type="button"
                        onClick={() => setAdding(true)}
                        className="text-[11px] font-bold underline hover:no-underline"
                    >
                        + Add Member
                    </button>
                )}
            </div>

            {adding && <AddMemberForm onDone={() => setAdding(false)} />}

            {members.length === 0 ? (
                <div className="text-center py-16 text-[10px] tracking-[0.1em] uppercase text-neutral-400 font-reformat">
                    No members yet
                </div>
            ) : (
                <div className="bg-white divide-y divide-[#f4f4f4]">
                    {members.map((m) => (
                        <MemberRow
                            key={m.id}
                            member={m}
                            isSelf={m.id === currentUserId}
                            canDelete={members.length > 1 && m.id !== currentUserId}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}

function AddMemberForm({ onDone }: { onDone: () => void }) {
    const [email, setEmail] = useState('')
    const [name, setName] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [pending, startTransition] = useTransition()

    function submit() {
        setError(null)
        startTransition(async () => {
            try {
                await createMember({ email, password, name: name || undefined })
                onDone()
            } catch (e) {
                setError(e instanceof Error ? e.message : 'Failed to create member')
            }
        })
    }

    return (
        <div className="bg-[#fafafa] p-5 space-y-3">
            <p className="font-reformat text-[9px] tracking-[0.1em] uppercase text-neutral-500">
                New member
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Field label="Name">
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Optional"
                        className={inputClass}
                    />
                </Field>
                <Field label="Email">
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        autoComplete="off"
                        className={inputClass}
                    />
                </Field>
                <Field label="Password">
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete="new-password"
                        placeholder="8+ characters"
                        className={inputClass}
                    />
                </Field>
            </div>
            {error && (
                <p className="text-[11px] text-[#8a0000]">{error}</p>
            )}
            <div className="flex items-center justify-end gap-5">
                <button
                    type="button"
                    onClick={onDone}
                    disabled={pending}
                    className="text-[11px] text-neutral-400 hover:text-black underline hover:no-underline disabled:opacity-40"
                >
                    Cancel
                </button>
                <button
                    type="button"
                    onClick={submit}
                    disabled={pending}
                    className="text-[12px] font-bold underline hover:no-underline disabled:opacity-40"
                >
                    {pending ? 'Adding…' : 'Add'}
                </button>
            </div>
        </div>
    )
}

function MemberRow({
    member,
    isSelf,
    canDelete,
}: {
    member: Member
    isSelf: boolean
    canDelete: boolean
}) {
    const [mode, setMode] = useState<'view' | 'rename' | 'password'>('view')
    const [name, setName] = useState(member.name ?? '')
    const [password, setPassword] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [pending, startTransition] = useTransition()

    function save() {
        setError(null)
        startTransition(async () => {
            try {
                if (mode === 'rename') {
                    await updateMemberName(member.id, name)
                } else if (mode === 'password') {
                    await resetMemberPassword(member.id, password)
                    setPassword('')
                }
                setMode('view')
            } catch (e) {
                setError(e instanceof Error ? e.message : 'Save failed')
            }
        })
    }

    function remove() {
        if (!confirm(`Remove ${member.email}?`)) return
        setError(null)
        startTransition(async () => {
            try {
                await deleteMember(member.id)
            } catch (e) {
                setError(e instanceof Error ? e.message : 'Delete failed')
            }
        })
    }

    return (
        <div className="px-3 py-3 flex flex-col gap-2">
            <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0 flex flex-col gap-[3px]">
                    {mode === 'rename' ? (
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Name"
                            className={`${inputClass} max-w-[260px]`}
                            autoFocus
                        />
                    ) : (
                        <span className="font-alte text-[14px] leading-none truncate">
                            {member.name || (
                                <span className="text-neutral-400">No name</span>
                            )}
                            {isSelf && (
                                <span className="ml-2 font-reformat text-[9px] tracking-[0.1em] uppercase text-neutral-400">
                                    You
                                </span>
                            )}
                        </span>
                    )}
                    <span className="font-reformat text-[10px] tracking-[0.05em] text-neutral-500 truncate">
                        {member.email}
                    </span>
                </div>
                <span className="font-reformat text-[9px] tracking-[0.06em] uppercase text-neutral-400 tabular-nums flex-shrink-0">
                    Joined{' '}
                    {new Date(member.createdAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                    })}
                </span>
            </div>

            {mode === 'password' && (
                <div className="flex items-center gap-3">
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="New password (8+ chars)"
                        autoComplete="new-password"
                        className={`${inputClass} max-w-[260px]`}
                        autoFocus
                    />
                </div>
            )}

            {error && <p className="text-[11px] text-[#8a0000]">{error}</p>}

            <div className="flex items-center gap-4 text-[10px] tracking-[0.05em]">
                {mode === 'view' ? (
                    <>
                        <button
                            type="button"
                            onClick={() => setMode('rename')}
                            className="text-neutral-400 hover:text-black underline hover:no-underline"
                        >
                            Rename
                        </button>
                        <button
                            type="button"
                            onClick={() => setMode('password')}
                            className="text-neutral-400 hover:text-black underline hover:no-underline"
                        >
                            Reset password
                        </button>
                        {canDelete && (
                            <button
                                type="button"
                                onClick={remove}
                                disabled={pending}
                                className="text-neutral-400 hover:text-red-500 underline hover:no-underline disabled:opacity-40"
                            >
                                Remove
                            </button>
                        )}
                    </>
                ) : (
                    <>
                        <button
                            type="button"
                            onClick={() => {
                                setMode('view')
                                setName(member.name ?? '')
                                setPassword('')
                                setError(null)
                            }}
                            disabled={pending}
                            className="text-neutral-400 hover:text-black underline hover:no-underline disabled:opacity-40"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={save}
                            disabled={pending}
                            className="font-bold underline hover:no-underline disabled:opacity-40"
                        >
                            {pending ? 'Saving…' : 'Save'}
                        </button>
                    </>
                )}
            </div>
        </div>
    )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <label className="flex flex-col gap-1">
            <span className="font-reformat text-[9px] tracking-[0.1em] uppercase text-neutral-500">
                {label}
            </span>
            {children}
        </label>
    )
}

const inputClass =
    'w-full px-3 py-2 bg-white border border-neutral-200 rounded text-[12px] focus:outline-none focus:border-black transition-colors placeholder:text-neutral-400'
