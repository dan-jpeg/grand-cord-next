export const STOCK_COLORS = {
    IN_STOCK: '#117137',      // green
    LOW_STOCK: '#FFE173',     // yellow
    NO_STOCK: '#DB0B00',      // red
    UNPUBLISHED: '#ffffff',   // white with border
} as const

export const STOCK_THRESHOLDS = {
    LOW_STOCK: 5, // Items below this count are "low stock"
} as const