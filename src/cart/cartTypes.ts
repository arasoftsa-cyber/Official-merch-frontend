export type CartItem = {
  id?: string | null;
  productId: string;
  variantId?: string | null;
  title: string;
  priceCents: number;
  quantity: number;
  imageUrl?: string | null;
  available?: boolean;
  availabilityReason?: string | null;
  availableStock?: number | null;
  lineTotalCents?: number | null;
  inventory?: {
    supplierSku?: string | null;
    merchType?: string | null;
    qualityTier?: string | null;
    size?: string | null;
    color?: string | null;
  } | null;
};

export type CartAction =
  | { type: 'init'; payload: CartItem[] }
  | { type: 'add'; payload: { item: Omit<CartItem, 'quantity'>; qty?: number } }
  | { type: 'remove'; payload: { productId: string; variantId?: string | null } }
  | { type: 'setQty'; payload: { productId: string; variantId?: string | null; qty: number } }
  | { type: 'clear' };
