import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react'

export interface CartItem {
  id: string
  title: string
  author: string | null
  cover_path: string | null
}

interface CartState {
  items: CartItem[]
  count: number
  has: (id: string) => boolean
  add: (item: CartItem) => void
  remove: (id: string) => void
  toggle: (item: CartItem) => void
  clear: () => void
}

const CartContext = createContext<CartState | undefined>(undefined)
const STORAGE_KEY = 'ayalot.cart'

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    } catch {
      return []
    }
  })

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  }, [items])

  const has = useCallback((id: string) => items.some((i) => i.id === id), [items])
  const add = useCallback(
    (item: CartItem) =>
      setItems((prev) => (prev.some((i) => i.id === item.id) ? prev : [...prev, item])),
    [],
  )
  const remove = useCallback(
    (id: string) => setItems((prev) => prev.filter((i) => i.id !== id)),
    [],
  )
  const toggle = useCallback(
    (item: CartItem) =>
      setItems((prev) =>
        prev.some((i) => i.id === item.id)
          ? prev.filter((i) => i.id !== item.id)
          : [...prev, item],
      ),
    [],
  )
  const clear = useCallback(() => setItems([]), [])

  return (
    <CartContext.Provider
      value={{ items, count: items.length, has, add, remove, toggle, clear }}
    >
      {children}
    </CartContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used within CartProvider')
  return ctx
}
