export type CartItem = {
  productId: string;
  title: string;
  price: number;
  qty: number;
  description?: string;
};

const STORAGE_KEY = 'om_cart_v1';

let cart: CartItem[] = [];
const listeners: Array<() => void> = [];

const loadCart = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      cart = Array.isArray(JSON.parse(raw)) ? JSON.parse(raw) : [];
    }
  } catch {
    cart = [];
  }
};

const persist = () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
  listeners.slice().forEach((fn) => fn());
};

export const getCart = () => {
  if (typeof window !== 'undefined') {
    if (!cart.length) {
      loadCart();
    }
  }
  return [...cart];
};

export const addItem = (item: CartItem) => {
  const existing = cart.find((entry) => entry.productId === item.productId);
  if (existing) {
    existing.qty += item.qty;
  } else {
    cart.push({ ...item });
  }
  persist();
};

export const removeItem = (productId: string) => {
  cart = cart.filter((entry) => entry.productId !== productId);
  persist();
};

export const updateQty = (productId: string, qty: number) => {
  if (qty <= 0) {
    removeItem(productId);
    return;
  }
  const entry = cart.find((item) => item.productId === productId);
  if (entry) {
    entry.qty = qty;
    persist();
  }
};

export const clearCart = () => {
  cart = [];
  persist();
};

export const subscribeCart = (fn: () => void) => {
  listeners.push(fn);
  return () => {
    const index = listeners.indexOf(fn);
    if (index >= 0) {
      listeners.splice(index, 1);
    }
  };
};
