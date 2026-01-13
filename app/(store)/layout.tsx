import { Navigation } from '@/components/store/navigation'

export default function StoreLayout({
                                        children,
                                    }: {
    children: React.ReactNode
}) {
    return (
        <>
            <Navigation />
            <main className="">
                {children}
            </main>
        </>
    )
}