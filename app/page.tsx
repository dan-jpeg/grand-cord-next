import { prisma } from '@/lib/prisma'
import { ProductCard } from '@/components/store/product-card'
import { CatalogHeader } from '@/components/store/catalog-header'


export const dynamic = 'force-dynamic'

import Image from 'next/image'
import heroImage from '../public/hero.png'

export default async function HomePage() {
    const products = await prisma.product.findMany({
        where: { published: true },
        include: { sizes: true },
        orderBy: { createdAt: 'desc' },
    })

    return (
        <div className="min-h-screen bg-white">
            {/* Hero Section */}
            <section className="relative hidden md:flex w-full">
                <div className="w-full bg-neutral-200 h-[60vh] flex items-center justify-center grayscale">

                    <Image
                        src={heroImage}
                        alt="Hero"
                        fill
                        className="object-cover grayscale"
                    />
                </div>
            </section>

            {/* Spacer */}
            <div className="h-40"/>
            <div className="flex flex-row">
                <p className="text-right pl-[5rem] leading-3 font-helvetica w-[700px] text-[7pt] italic">
                    This is a group which has no name because we are not finished being born.
                    What we have in common is a way through time, and that path is our meeting place.
                    In the body of every spider, there's unmade silk.
                </p>
                <p className="uppercase font-bold text-[9pt] pl-[10rem]">grand-cord</p>
            </div>
            <div className="h-40" />
            <div className="h-16" />

            {/* Catalog Section */}
            <section className="py-24">
                <CatalogHeader productCount={products.length}/>

                <div className="h-24"/>

                <div className="grid grid-cols-1 gap-x-1.5 gap-y-16 pb-8 md:grid-cols-2 lg:grid-cols-3">
                    {products.map((product, index) => (
                        <ProductCard key={product.id} product={product} index={index}/>
                    ))}
                </div>
                <div className="grid grid-cols-1 gap-x-1.5 gap-y-16 pb-8 md:grid-cols-2 lg:grid-cols-3">
                    {products.map((product, index) => (
                        <ProductCard key={product.id} product={product} index={index}/>
                    ))}
                </div>
                <div className="grid grid-cols-1 gap-x-1.5 gap-y-16 pb-8 md:grid-cols-2 lg:grid-cols-3">
                    {products.map((product, index) => (
                        <ProductCard key={product.id} product={product} index={index}/>
                    ))}
                </div>
                <div className="grid grid-cols-1 gap-x-1.5 gap-y-16 pb-8 md:grid-cols-2 lg:grid-cols-3">
                    {products.map((product, index) => (
                        <ProductCard key={product.id} product={product} index={index}/>
                    ))}
                </div>
            </section>
        </div>
    )
}