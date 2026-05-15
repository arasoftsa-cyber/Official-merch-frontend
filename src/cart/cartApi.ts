import { apiFetch } from '../shared/api/http';
import type { CartItem } from './cartTypes';

type ApiCartItem = {
  id?: string | null;
  productId?: string | null;
  productVariantId?: string | null;
  quantity?: number | null;
  available?: boolean | null;
  availabilityReason?: string | null;
  availableStock?: number | null;
  unitPriceCents?: number | null;
  lineTotalCents?: number | null;
  product?: {
    title?: string | null;
  } | null;
  inventory?: {
    supplierSku?: string | null;
    merchType?: string | null;
    qualityTier?: string | null;
    size?: string | null;
    color?: string | null;
  } | null;
};

type ApiCart = {
  items?: ApiCartItem[] | null;
};

type ApiCartResponse = {
  cart?: ApiCart | null;
};

const toText = (value: unknown): string => {
  return typeof value === 'string' ? value.trim() : '';
};

const toPositiveInteger = (value: unknown, fallback = 0): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const normalized = Math.floor(parsed);
  return normalized >= 0 ? normalized : fallback;
};

const toBoolean = (value: unknown): boolean | undefined => {
  if (typeof value === 'boolean') return value;
  return undefined;
};

const normalizeCartItem = (item: ApiCartItem): CartItem | null => {
  const productId = toText(item?.productId);
  const variantId = toText(item?.productVariantId);
  if (!productId || !variantId) return null;

  return {
    id: toText(item?.id) || null,
    productId,
    variantId,
    title: toText(item?.product?.title) || 'Product',
    priceCents: toPositiveInteger(item?.unitPriceCents),
    quantity: Math.max(1, toPositiveInteger(item?.quantity, 1)),
    available: toBoolean(item?.available),
    availabilityReason: toText(item?.availabilityReason) || null,
    availableStock: toPositiveInteger(item?.availableStock, 0),
    lineTotalCents: toPositiveInteger(item?.lineTotalCents, 0),
    inventory: item?.inventory
      ? {
        supplierSku: toText(item.inventory.supplierSku) || null,
        merchType: toText(item.inventory.merchType) || null,
        qualityTier: toText(item.inventory.qualityTier) || null,
        size: toText(item.inventory.size) || null,
        color: toText(item.inventory.color) || null,
      }
      : null,
  };
};

export const normalizeApiCartItems = (payload: ApiCartResponse | null | undefined): CartItem[] => {
  const items = Array.isArray(payload?.cart?.items) ? payload.cart.items : [];
  return items
    .map(normalizeCartItem)
    .filter((item): item is CartItem => Boolean(item));
};

export async function fetchRemoteCart(): Promise<CartItem[]> {
  const response = (await apiFetch('/cart')) as ApiCartResponse;
  return normalizeApiCartItems(response);
}

export async function addRemoteCartItem(input: {
  productId: string;
  productVariantId: string;
  quantity: number;
}): Promise<CartItem[]> {
  const response = (await apiFetch('/cart/items', {
    method: 'POST',
    body: input,
  })) as ApiCartResponse;
  return normalizeApiCartItems(response);
}

export async function updateRemoteCartItemQuantity(
  itemId: string,
  quantity: number
): Promise<CartItem[]> {
  const response = (await apiFetch(`/cart/items/${itemId}`, {
    method: 'PATCH',
    body: { quantity },
  })) as ApiCartResponse;
  return normalizeApiCartItems(response);
}

export async function removeRemoteCartItem(itemId: string): Promise<CartItem[]> {
  const response = (await apiFetch(`/cart/items/${itemId}`, {
    method: 'DELETE',
  })) as ApiCartResponse;
  return normalizeApiCartItems(response);
}

export async function clearRemoteCart(): Promise<CartItem[]> {
  const response = (await apiFetch('/cart', {
    method: 'DELETE',
  })) as ApiCartResponse;
  return normalizeApiCartItems(response);
}
