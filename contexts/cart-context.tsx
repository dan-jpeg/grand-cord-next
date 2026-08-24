'use client'

import { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react'

export type CartItem = {
    productId: string
    productName: string
    productSlug: string
    size: string
    quantity: number
    price: number
    image?: string
    material?: string
    color?: string
}

type CartContextType = {
    items: CartItem[]
    addItem: (item: Omit<CartItem, 'quantity'>) => void
    removeItem: (productId: string, size: string) => void
    updateQuantity: (productId: string, size: string, quantity: number) => void
    clearCart: () => void
    /**
     * Rewrites stored line prices to the catalogue's current ones.
     *
     * Checkout charges the catalogue price regardless of what is in the cart —
     * this keeps the number on screen honest about that, so the total shown is
     * the total taken.
     */
    syncPrices: (priced: { productId: string; size: string; price: number }[]) => void
    totalItems: number
    totalPrice: number
}

const CartContext = createContext<CartContextType | undefined>(undefined)

export function CartProvider({ children }: { children: ReactNode }) {
    const [items, setItems] = useState<CartItem[]>([])
    const [isHydrated, setIsHydrated] = useState(false)
    const addingRef = useRef(false)

    // Load cart from localStorage on mount
    useEffect(() => {
        const savedCart = localStorage.getItem('cart')
        if (savedCart) {
            setItems(JSON.parse(savedCart))
        }
        setIsHydrated(true)
    }, [])

    // Save cart to localStorage whenever it changes
    useEffect(() => {
        if (isHydrated) {
            localStorage.setItem('cart', JSON.stringify(items))
        }
    }, [items, isHydrated])

    const addItem = (newItem: Omit<CartItem, 'quantity'>) => {
        setItems(currentItems => {
            const existingIndex = currentItems.findIndex(
                item =>
                    item.productId === newItem.productId &&
                    item.size === newItem.size
            )

            if (existingIndex !== -1) {
                return currentItems.map((item, i) =>
                    i === existingIndex
                        ? { ...item, quantity: item.quantity + 1 }
                        : item
                )
            }

            return [...currentItems, { ...newItem, quantity: 1 }]
        })
    }

    const removeItem = (productId: string, size: string) => {
        setItems((currentItems) =>
            currentItems.filter((item) => !(item.productId === productId && item.size === size))
        )
    }

    const updateQuantity = (productId: string, size: string, quantity: number) => {
        if (quantity <= 0) {
            removeItem(productId, size)
            return
        }

        setItems((currentItems) =>
            currentItems.map((item) =>
                item.productId === productId && item.size === size
                    ? { ...item, quantity }
                    : item
            )
        )
    }

    const clearCart = () => {
        setItems([])
    }

    const syncPrices = (
        priced: { productId: string; size: string; price: number }[]
    ) => {
        setItems(currentItems => {
            const priceByKey = new Map(
                priced.map(p => [`${p.productId}-${p.size}`, p.price])
            )
            let changed = false
            const next = currentItems.map(item => {
                const price = priceByKey.get(`${item.productId}-${item.size}`)
                if (price === undefined || price === item.price) return item
                changed = true
                return { ...item, price }
            })
            // Same array back when nothing moved, so this cannot loop a
            // subscriber that re-checks prices whenever items change.
            return changed ? next : currentItems
        })
    }

    const totalItems = items.reduce((sum, item) => sum + item.quantity, 0)
    const totalPrice = items.reduce((sum, item) => sum + item.price * item.quantity, 0)

    return (
        <CartContext.Provider
            value={{
                items,
                addItem,
                removeItem,
                updateQuantity,
                clearCart,
                syncPrices,
                totalItems,
                totalPrice,
            }}
        >
            {children}
        </CartContext.Provider>
    )
}

export function useCart() {
    const context = useContext(CartContext)
    if (!context) {
        throw new Error('useCart must be used within CartProvider')
    }
    return context
}