'use client'

export function CatalogHeader({ productCount }: { productCount: number }) {
    return (
        <div className="sticky top-12 z-40 mb-12">
            <div className="flex items-start justify-between pb-4">
                <div className="flex-row pl-[5rem] flex gap-x-6">
                    <h2 className="text-[9pt] font-bold">CATALOG</h2>
                    <p className="text-[7pt] mt-[1px]">2022-2026</p>
                </div>
                <span className="text-sm font-bold pr-[3rem]">{productCount}</span>
            </div>
        </div>
    )
}