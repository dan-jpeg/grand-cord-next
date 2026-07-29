export default function PickLayout({ children }: { children: React.ReactNode }) {
    // Normalize the whole pick route to Alte Haas Grotesk so it matches the
    // rest of the design (no stray mono / browser-default sans).
    return <div className="font-alte">{children}</div>
}
