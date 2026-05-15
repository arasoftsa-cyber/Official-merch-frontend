import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  AUTH_SESSION_UPDATED_EVENT,
  getAccessToken,
  getRefreshToken,
  getSessionUser,
} from '../shared/auth/tokenStore';
import {
  addRemoteCartItem,
  clearRemoteCart,
  fetchRemoteCart,
  removeRemoteCartItem,
  updateRemoteCartItemQuantity,
} from './cartApi';
import type { CartItem } from './cartTypes';

const GUEST_STORAGE_KEY = 'om_cart_v1';
const SERVER_STORAGE_KEY = 'om_cart_server_v1';
const CART_UPDATED_EVENT = 'om:cart-updated';

const normalizeVariantId = (value?: string | null) => value ?? '';
const hasAuthenticatedSession = () =>
  Boolean(getAccessToken() || getRefreshToken() || getSessionUser());

const readStoredItems = (storageKey: string): CartItem[] => {
  try {
    const raw = localStorage.getItem(storageKey);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

type CartContextValue = {
  items: CartItem[];
  cartCount: number;
  cartTotalCents: number;
  addItem: (item: Omit<CartItem, 'quantity'>, qty?: number) => Promise<void>;
  removeItem: (item: Pick<CartItem, 'id' | 'productId' | 'variantId'>) => Promise<void>;
  setQty: (
    item: Pick<CartItem, 'id' | 'productId' | 'variantId'>,
    qty: number
  ) => Promise<void>;
  clearCart: () => Promise<void>;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: React.PropsWithChildren<{}>) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => hasAuthenticatedSession());
  const [items, setItems] = useState<CartItem[]>(() =>
    readStoredItems(hasAuthenticatedSession() ? SERVER_STORAGE_KEY : GUEST_STORAGE_KEY)
  );

  useEffect(() => {
    localStorage.setItem(
      isAuthenticated ? SERVER_STORAGE_KEY : GUEST_STORAGE_KEY,
      JSON.stringify(items)
    );
    window.dispatchEvent(new CustomEvent(CART_UPDATED_EVENT));
  }, [isAuthenticated, items]);

  const syncRemoteCart = useCallback(async () => {
    if (!hasAuthenticatedSession()) return;
    const remoteItems = await fetchRemoteCart();
    setItems(remoteItems);
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      void syncRemoteCart();
    }

    const handleAuthSessionUpdated = () => {
      const nextIsAuthenticated = hasAuthenticatedSession();
      setIsAuthenticated(nextIsAuthenticated);
      setItems(
        readStoredItems(nextIsAuthenticated ? SERVER_STORAGE_KEY : GUEST_STORAGE_KEY)
      );
      if (nextIsAuthenticated) {
        void syncRemoteCart();
      }
    };

    window.addEventListener(AUTH_SESSION_UPDATED_EVENT, handleAuthSessionUpdated);
    return () => {
      window.removeEventListener(AUTH_SESSION_UPDATED_EVENT, handleAuthSessionUpdated);
    };
  }, [isAuthenticated, syncRemoteCart]);

  const cartCount = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity, 0),
    [items]
  );

  const cartTotalCents = useMemo(
    () =>
      items.reduce((sum, item) => sum + item.priceCents * item.quantity, 0),
    [items]
  );

  const addItem = useCallback(async (item: Omit<CartItem, 'quantity'>, qty = 1) => {
    const variantId = normalizeVariantId(item.variantId);
    const normalizedQty = Math.max(1, Math.floor(Number(qty) || 1));

    if (isAuthenticated) {
      if (!variantId) {
        throw new Error('Select a variant before adding this item to the cart.');
      }
      const remoteItems = await addRemoteCartItem({
        productId: item.productId,
        productVariantId: variantId,
        quantity: normalizedQty,
      });
      setItems(remoteItems);
      return;
    }

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
          quantity: next[existingIndex].quantity + normalizedQty,
        };
        return next;
      }
      return [
        ...prev,
        {
          ...item,
          variantId,
          quantity: normalizedQty,
        },
      ];
    });
  }, [isAuthenticated]);

  const removeItem = useCallback(async (item: Pick<CartItem, 'id' | 'productId' | 'variantId'>) => {
    const productId = item.productId;
    const target = normalizeVariantId(item.variantId);

    if (isAuthenticated) {
      const existing = items.find(
        (entry) =>
          entry.id === item.id ||
          (entry.productId === productId &&
            normalizeVariantId(entry.variantId) === target)
      );
      const remoteItemId = existing?.id ?? item.id;
      if (!remoteItemId) {
        throw new Error('Could not resolve this cart item for a server delete.');
      }
      const remoteItems = await removeRemoteCartItem(remoteItemId);
      setItems(remoteItems);
      return;
    }

    setItems((prev) =>
      prev.filter(
        (entry) =>
          entry.productId !== productId ||
          normalizeVariantId(entry.variantId) !== target
      )
    );
  }, [isAuthenticated, items]);

  const setQty = useCallback(async (
    item: Pick<CartItem, 'id' | 'productId' | 'variantId'>,
    qty: number
  ) => {
    const productId = item.productId;
    const target = normalizeVariantId(item.variantId);
    if (qty <= 0) {
      await removeItem(item);
      return;
    }

    if (isAuthenticated) {
      const existing = items.find(
        (entry) =>
          entry.id === item.id ||
          (entry.productId === productId &&
            normalizeVariantId(entry.variantId) === target)
      );
      const remoteItemId = existing?.id ?? item.id;
      if (!remoteItemId) {
        throw new Error('Could not resolve this cart item for a server update.');
      }
      const remoteItems = await updateRemoteCartItemQuantity(remoteItemId, qty);
      setItems(remoteItems);
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
  }, [isAuthenticated, items, removeItem]);

  const clearCart = useCallback(async () => {
    if (isAuthenticated) {
      const remoteItems = await clearRemoteCart();
      setItems(remoteItems);
      return;
    }
    setItems([]);
  }, [isAuthenticated]);

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
    [addItem, cartCount, cartTotalCents, clearCart, items, removeItem, setQty]
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
