import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { CartItem } from './cartTypes';

const STORAGE_KEY = 'om_cart_v1';

const normalizeVariantId = (value?: string | null) => value ?? '';

type CartContextValue = {
  items: CartItem[];
  cartCount: number;
  cartTotalCents: number;
  addItem: (item: Omit<CartItem, 'quantity'>, qty?: number) => void;
  removeItem: (productId: string, variantId?: string | null) => void;
  setQty: (productId: string, variantId: string | null | undefined, qty: number) => void;
  clearCart: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: React.PropsWithChildren<{}>) {
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const cartCount = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity, 0),
    [items]
  );

  const cartTotalCents = useMemo(
    () =>
      items.reduce((sum, item) => sum + item.priceCents * item.quantity, 0),
    [items]
  );

  const addItem = (item: Omit<CartItem, 'quantity'>, qty = 1) => {
    const variantId = normalizeVariantId(item.variantId);
    setItems((prev) => {
      const existingIndex = prev.findIndex(
        (entry) =>
          entry.productId === item.productId &&
          normalizeVariantId(entry.variantId) === variantId
      );
      if (existingIndex >= 0) {
        const next = [...prev];
        next[existingIndex] = {
          ...next[existingIndex],
          quantity: next[existingIndex].quantity + qty,
        };
        return next;
      }
      return [
        ...prev,
        {
          ...item,
          variantId,
          quantity: qty,
        },
      ];
    });
  };

  const removeItem = (productId: string, variantId?: string | null) => {
    const target = normalizeVariantId(variantId);
    setItems((prev) =>
      prev.filter(
        (entry) =>
          entry.productId !== productId ||
          normalizeVariantId(entry.variantId) !== target
      )
    );
  };

  const setQty = (
    productId: string,
    variantId: string | null | undefined,
    qty: number
  ) => {
    const target = normalizeVariantId(variantId);
    if (qty <= 0) {
      removeItem(productId, variantId);
      return;
    }
    setItems((prev) =>
      prev.map((entry) => {
        if (
          entry.productId === productId &&
          normalizeVariantId(entry.variantId) === target
        ) {
          return { ...entry, quantity: qty };
        }
        return entry;
      })
    );
  };

  const clearCart = () => setItems([]);

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      cartCount,
      cartTotalCents,
      addItem,
      removeItem,
      setQty,
      clearCart,
    }),
    [items, cartCount, cartTotalCents]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return ctx;
}
