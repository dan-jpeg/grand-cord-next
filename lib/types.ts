import { Product, ProductSize, Order, OrderItem, Collection, BlogPost } from '@prisma/client'

// Product with sizes
export type ProductWithSizes = Product & {
  sizes: ProductSize[]
}

// Product with sizes and collections
export type ProductWithRelations = Product & {
  sizes: ProductSize[]
  collections: {
    collection: Collection
  }[]
}

// Order with items
export type OrderWithItems = Order & {
  items: OrderItem[]
}

// Cart item (client-side)
export type CartItem = {
  productId: string
  productName: string
  productSlug: string
  size: string
  quantity: number
  price: number
  image?: string
}

// Shipping address
export type ShippingAddress = {
  name: string
  address: string
  city: string
  state: string
  zip: string
  country: string
}

// Admin stats
export type AdminStats = {
  totalOrders: number
  totalRevenue: number
  pendingOrders: number
  lowStockProducts: number
}