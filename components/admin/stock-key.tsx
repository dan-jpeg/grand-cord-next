import { STOCK_COLORS } from '@/lib/constants'

type Variant = 'row' | 'column' | 'grid'
type StockFilter = 'ALL' | 'IN_STOCK' | 'LOW_STOCK' | 'NO_STOCK' | 'UNPUBLISHED'

type StockKeyProps = {
    variant?: Variant
    selectedFilter?: StockFilter
    onFilterChange?: (filter: StockFilter) => void
}

export function StockKey({ variant = 'row', selectedFilter = 'ALL', onFilterChange }: StockKeyProps) {
    const items = [
        { color: STOCK_COLORS.IN_STOCK, label: 'IN STOCK', filter: 'IN_STOCK' as const },
        { color: STOCK_COLORS.LOW_STOCK, label: 'LOW STOCK', filter: 'LOW_STOCK' as const },
        { color: STOCK_COLORS.NO_STOCK, label: 'NO STOCK', filter: 'NO_STOCK' as const },
        { color: STOCK_COLORS.UNPUBLISHED, label: 'UNPUBLISHED', filter: 'UNPUBLISHED' as const, bordered: true },
    ]

    if (variant === 'row') {
        return (
            <div className="flex fixed top-4 right-4 items-center gap-3 z-[600]">
                {items.map((item) => (
                    <button
                        key={item.label}
                        onClick={() => onFilterChange?.(selectedFilter === item.filter ? 'ALL' : item.filter)}
                        className={`flex items-center gap-1 transition-opacity ${
                            selectedFilter !== 'ALL' && selectedFilter !== item.filter
                                ? 'opacity-30'
                                : 'opacity-100'
                        } hover:opacity-20`}
                    >
                        <div
                            className="w-[20px] h-[11px]"
                            style={{
                                backgroundColor: item.color,
                                border: item.bordered ? '1px solid black' : 'none',
                            }}
                        />
                        <span className={`text-[7pt] font-bold uppercase ${
                            selectedFilter === item.filter ? 'underline' : ''
                        }`}>
                            {item.label}
                        </span>
                    </button>
                ))}
            </div>
        )
    }

    if (variant === 'column') {
        return (
            <div className="flex flex-col gap-4 z-[600] ">
                {items.map((item) => (
                    <button
                        key={item.label}
                        onClick={() => onFilterChange?.(selectedFilter === item.filter ? 'ALL' : item.filter)}
                        className={`flex items-center gap-3 transition-opacity ${
                            selectedFilter !== 'ALL' && selectedFilter !== item.filter
                                ? 'opacity-30'
                                : 'opacity-100'
                        } hover:opacity-20`}
                    >
                        <div
                            className="w-[20px] h-[11px]"
                            style={{
                                backgroundColor: item.color,
                                border: item.bordered ? '1px solid black' : 'none',
                            }}
                        />
                        <span className={`text-[8pt] font-bold uppercase tracking-wide ${
                            selectedFilter === item.filter ? 'underline' : ''
                        }`}>
                            {item.label}
                        </span>
                    </button>
                ))}
            </div>
        )
    }

    // grid (2x2)
    return (
        <div className="fixed  bottom-30 left-0 right-0 flex justify-center z-[600]">
            <div className="grid grid-cols-2 gap-x-8 gap-y-4 ">
                {items.map((item) => (
                    <button
                        key={item.label}
                        onClick={() => onFilterChange?.(selectedFilter === item.filter ? 'ALL' : item.filter)}
                        className={`flex items-center gap-1 transition-opacity ${
                            selectedFilter !== 'ALL' && selectedFilter !== item.filter
                                ? 'opacity-30'
                                : 'opacity-100'
                        } hover:opacity-20`}
                    >
                        <div
                            className="w-[20px] h-[11px]"
                            style={{
                                backgroundColor: item.color,
                                border: item.bordered ? '1px solid black' : 'none',
                            }}
                        />
                        <span className={`text-[7pt] font-bold uppercase ${
                            selectedFilter === item.filter ? 'underline' : ''
                        }`}>
                            {item.label}
                        </span>
                    </button>
                ))}
            </div>
        </div>

    )
}