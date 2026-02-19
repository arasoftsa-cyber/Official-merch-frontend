export type CartItem = {
  productId: string;
  variantId?: string | null;
  title: string;
  priceCents: number;
  quantity: number;
  imageUrl?: string | null;
};

export type CartAction =
  | { type: 'init'; payload: CartItem[] }
  | { type: 'add'; payload: { item: Omit<CartItem, 'quantity'>; qty?: number } }
  | { type: 'remove'; payload: { productId: string; variantId?: string | null } }
  | { type: 'setQty'; payload: { productId: string; variantId?: string | null; qty: number } }
  | { type: 'clear' };
