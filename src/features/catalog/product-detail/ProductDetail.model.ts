import { formatCurrencyFromCents } from '../../../shared/utils/formatting';
import { createApiContractError, readObjectEnvelope } from '../../../shared/api/contract';
import { resolveMediaUrl } from '../../../shared/utils/media';

export type Variant = {
  id: string;
  sku?: string;
  size?: string;
  color?: string;
  priceCents?: number;
  stock?: number;
  effectiveSellable?: boolean;
  effectiveIsActive?: boolean;
  skuIsActive?: boolean;
  variantIsListed?: boolean;
};

export type Product = {
  id: string;
  title?: string;
  description?: string;
  priceCents?: number;
  listingPhotoUrls?: string[];
};

function asObject(value: unknown): Record<string, any> | null {
  return value !== null && typeof value === 'object' ? (value as Record<string, any>) : null;
}

const PRODUCT_DETAIL_DOMAIN = 'catalog.productDetail';

function toCents(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Number.isInteger(value) ? value : Math.round(value * 100);
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return Number.isInteger(parsed) ? parsed : Math.round(parsed * 100);
    }
  }
  return null;
}

function resolveCents(source: Record<string, any> | null): number | null {
  if (!source) return null;
  const cents = toCents(source.price_cents ?? source.priceCents);
  if (cents !== null) return cents;
  return toCents(source.price);
}

export function formatCurrency(cents: number) {
  return formatCurrencyFromCents(cents);
}

function normalizeProductListingPhotos(
  productSource: Record<string, any>
): string[] {
  const photoCandidates = Array.isArray(productSource.listingPhotoUrls)
    ? productSource.listingPhotoUrls
    : Array.isArray(productSource.listing_photos)
      ? productSource.listing_photos
      : [];

  return photoCandidates
    .map((value) => resolveMediaUrl(typeof value === 'string' ? value : null))
    .filter((value): value is string => Boolean(value))
    .slice(0, 4);
}

function normalizeVariant(raw: any, index: number): Variant {
  const source = asObject(raw) ?? {};
  const rawId = source.id ?? source.variantId ?? source.sku ?? `variant-${index + 1}`;
  const coerceBoolean = (value: unknown): boolean | undefined => {
    if (typeof value === 'boolean') return value;
    if (value === 1 || value === '1' || value === 'true') return true;
    if (value === 0 || value === '0' || value === 'false') return false;
    return undefined;
  };
  return {
    id: String(rawId),
    sku: typeof source.sku === 'string' ? source.sku : undefined,
    size: typeof source.size === 'string' ? source.size : undefined,
    color: typeof source.color === 'string' ? source.color : undefined,
    priceCents: resolveCents(source) ?? undefined,
    stock: typeof source.stock === 'number' ? source.stock : undefined,
    effectiveSellable:
      coerceBoolean(source.effectiveSellable ?? source.effective_sellable),
    effectiveIsActive:
      coerceBoolean(source.effectiveIsActive ?? source.effective_is_active),
    skuIsActive: coerceBoolean(source.skuIsActive ?? source.sku_is_active),
    variantIsListed:
      coerceBoolean(source.variantIsListed ?? source.variant_is_listed),
  };
}

export function normalizePayload(payload: any, fallbackId: string) {
  const productSource = readObjectEnvelope(payload, 'product', PRODUCT_DETAIL_DOMAIN, {
    allowDirect: true,
  });
  const rootSource = asObject(payload);
  const productId = String(productSource.id ?? fallbackId).trim();
  if (!productId) {
    throw createApiContractError(
      PRODUCT_DETAIL_DOMAIN,
      'Product detail response is missing a canonical product id.'
    );
  }

  const product: Product = {
    id: productId,
    title: typeof productSource.title === 'string' ? productSource.title : undefined,
    description: typeof productSource.description === 'string' ? productSource.description : undefined,
    priceCents: resolveCents(productSource) ?? undefined,
    listingPhotoUrls: normalizeProductListingPhotos(productSource),
  };

  const variantsSource = Array.isArray(productSource.variants)
    ? productSource.variants
    : Array.isArray(rootSource?.variants)
      ? rootSource.variants
      : [];

  const variants = variantsSource.map((variant, index) => normalizeVariant(variant, index));
  return { product, variants };
}


