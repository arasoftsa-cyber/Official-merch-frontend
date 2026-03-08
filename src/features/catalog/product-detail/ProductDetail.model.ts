export type Variant = {
  id: string;
  sku?: string;
  size?: string;
  color?: string;
  priceCents?: number;
  stock?: number;
};

export type Product = {
  id: string;
  title?: string;
  description?: string;
  priceCents?: number;
  listing_photos?: string[];
};

function asObject(value: unknown): Record<string, any> | null {
  return value !== null && typeof value === 'object' ? (value as Record<string, any>) : null;
}

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
  return `$${(cents / 100).toFixed(2)}`;
}

function normalizeProductListingPhotos(
  productSource: Record<string, any> | null,
  root: Record<string, any>,
  data: Record<string, any> | null
): string[] {
  const fromProduct = Array.isArray(productSource?.listing_photos)
    ? productSource.listing_photos
    : Array.isArray(productSource?.listingPhotos)
      ? productSource.listingPhotos
      : Array.isArray(productSource?.listingPhotoUrls)
        ? productSource.listingPhotoUrls
        : Array.isArray(productSource?.photoUrls)
          ? productSource.photoUrls
          : Array.isArray(productSource?.photos)
            ? productSource.photos
            : [];
  const fromPayload = Array.isArray(root?.listing_photos)
    ? root.listing_photos
    : Array.isArray(root?.listingPhotos)
      ? root.listingPhotos
      : Array.isArray(root?.listingPhotoUrls)
        ? root.listingPhotoUrls
        : Array.isArray(data?.listing_photos)
          ? data.listing_photos
          : Array.isArray(data?.listingPhotos)
            ? data.listingPhotos
            : Array.isArray(data?.listingPhotoUrls)
              ? data.listingPhotoUrls
              : Array.isArray(root?.photoUrls)
                ? root.photoUrls
                : Array.isArray(data?.photoUrls)
                  ? data.photoUrls
                  : Array.isArray(root?.photos)
                    ? root.photos
                    : Array.isArray(data?.photos)
                      ? data.photos
                      : [];

  return (fromProduct.length ? fromProduct : fromPayload)
    .filter(
      (value): value is string => typeof value === 'string' && value.trim().length > 0
    )
    .slice(0, 4);
}

function normalizeVariant(raw: any, index: number): Variant {
  const source = asObject(raw) ?? {};
  const rawId = source.id ?? source.variantId ?? source.sku ?? `variant-${index + 1}`;
  return {
    id: String(rawId),
    sku: typeof source.sku === 'string' ? source.sku : undefined,
    size: typeof source.size === 'string' ? source.size : undefined,
    color: typeof source.color === 'string' ? source.color : undefined,
    priceCents: resolveCents(source) ?? undefined,
    stock: typeof source.stock === 'number' ? source.stock : undefined,
  };
}

export function normalizePayload(payload: any, fallbackId: string) {
  const root = asObject(payload) ?? {};
  const data = asObject(root.data);
  const productSource =
    asObject(data?.product) ??
    asObject(data?.item) ??
    asObject(data) ??
    asObject(root.product) ??
    asObject(root.item);

  if (!productSource) return null;

  const product: Product = {
    id: String(productSource.id ?? fallbackId),
    title: typeof productSource.title === 'string' ? productSource.title : undefined,
    description: typeof productSource.description === 'string' ? productSource.description : undefined,
    priceCents: resolveCents(productSource) ?? undefined,
    listing_photos: normalizeProductListingPhotos(productSource, root, data),
  };

  const variantsSource = Array.isArray(productSource.variants)
    ? productSource.variants
    : Array.isArray(data?.variants)
      ? data.variants
      : Array.isArray(root.variants)
        ? root.variants
        : Array.isArray(productSource.items)
          ? productSource.items
          : [];

  const variants = variantsSource.map((variant, index) => normalizeVariant(variant, index));
  return { product, variants };
}
