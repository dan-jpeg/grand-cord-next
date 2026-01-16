import { Navigation } from '@/components/store/navigation'
import { AddToCartNotification } from '@/components/store/add-to-cart-notification'

export default function StoreLayout({
                                        children,
                                    }: {
    children: React.ReactNode
}) {
    return (
        <>
            <Navigation />
            {/*<AddToCartNotification />*/}
            <main className="">
                {children}
            </main>
        </>
    )
}