'use client'

import { useEffect, useState } from 'react'

export function MobileHero() {
    const [scrollY, setScrollY] = useState(0)

    useEffect(() => {
        let raf = 0

        const onScroll = () => {
            cancelAnimationFrame(raf)
            raf = requestAnimationFrame(() => {
                setScrollY(window.scrollY)
            })
        }

        window.addEventListener('scroll', onScroll, { passive: true })

        return () => {
            cancelAnimationFrame(raf)
            window.removeEventListener('scroll', onScroll)
        }
    }, [])

    // Title and description fade out as you scroll
    const contentOpacity = Math.max(0, 1 - scrollY / 400)

    // Title moves up as you scroll
    const titleTransform = Math.min(scrollY / 1, 150)

    return (
        <div className="relative" style={{minHeight: '150vh'}}>
            {/* Fixed title that fades and moves */}
            <div
                className="fixed left-0 right-0 px-6 z-10"
                style={{
                    top: '120px',
                    opacity: 1,
                    transform: `translateY(-${titleTransform}px)`
                }}
            >
                <h1 className="text-center italic text-[8pt] mb-8">
                    Grand-Cord
                </h1>

                <p className="text-[6pt] pt-0 italic leading-[1.4]">
                    This catalog is the work of many people; founded as a shared framework for independent studios.
                    Grand-Cord is supported by those involved and takes no commission. All orders are shipped from
                    Chicago.
                </p>
            </div>

            {/* Contact info - positioned in the flow, revealed on scroll */}
            <div className="absolute top-[100vh] left-0 right-0 px-6">
                <div className="text-[8pt]">
                    <div className="italic opacity-60 mb-2">messenger @ grand-cord.com</div>
                    <div className="leading-tight">
                        <div>4100 W Grand Ave</div>
                        <div>Chicago IL 60651</div>
                    </div>
                </div>
            </div>

            {/* Release marker at the very bottom */}
            <div id="hero-release" className="absolute bottom-0 h-px w-full"/>
        </div>
    )
}