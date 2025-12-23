import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import Image from 'next/image'

export default async function AdminLayout({
                                              children,
                                          }: {
    children: React.ReactNode
}) {
    const session = await auth()
    const ordersCount = session ? await prisma.order.count({ where: { status: 'PAID' } }) : 0

    return (
        <div className="min-h-screen  flex items-center justify-center p-8 relative">
            {/* Background Image */}
            {/*<div className="absolute scale-[2] inset-0">*/}
            {/*    <Image*/}
            {/*        src="/blank-grid.png"*/}
            {/*        alt="Admin background"*/}
            {/*        fill*/}
            {/*        className="object-contain"*/}
            {/*        priority*/}
            {/*    />*/}
            {/*</div>*/}

            {/* Content Container */}
            <div className="w-full max-w-6xl aspect-[4/3] relative z-10">
                {session ? children : (
                    <div className="absolute inset-0 flex items-center justify-center">
                        {children}
                    </div>
                )}
            </div>
        </div>
    )
}