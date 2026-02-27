import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { fetchJson } from '../shared/api';
import { useToast } from '../components/ux/ToastHost';
import ErrorState from '../components/ux/ErrorState';
import LoadingState from '../components/ux/LoadingState';
import { trackPageView } from '../shared/telemetry';
import Input from '../components/ui/Input';
import Label from '../components/ui/Label';
import { Container, Page } from '../ui/Page';
import { useCart } from '../cart/CartContext';
import { NotFoundPage } from './Errors';
import { safeErrorMessage } from '../shared/utils/safeError';
import { apiFetch } from '../shared/api/http';
import { resolveMediaUrl } from '../shared/utils/media';

type Variant = {
  id: string;
  sku?: string;
  size?: string;
  color?: string;
  priceCents?: number;
  stock?: number;
};

type Product = {
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

function formatCurrency(cents: number) {
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

function normalizePayload(payload: any, fallbackId: string) {
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

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const [product, setProduct] = useState<Product | null>(null);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [status, setStatus] = useState<'loading' | 'idle' | 'error' | 'not_found'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [buyNowLoading, setBuyNowLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedVariantId, setSelectedVariantId] = useState<string>('');
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [selectedColor, setSelectedColor] = useState<string>('');
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [mainImageLoadError, setMainImageLoadError] = useState(false);

  const hasVariants = variants.length > 0;
  const sizeOptions = useMemo(
    () => Array.from(new Set(variants.map((variant) => variant.size).filter(Boolean))) as string[],
    [variants]
  );
  const colorOptions = useMemo(
    () => Array.from(new Set(variants.map((variant) => variant.color).filter(Boolean))) as string[],
    [variants]
  );

  const filteredVariants = useMemo(() => {
    if (!hasVariants) return [];
    return variants.filter((variant) => {
      if (selectedSize && variant.size !== selectedSize) return false;
      if (selectedColor && variant.color !== selectedColor) return false;
      return true;
    });
  }, [hasVariants, selectedColor, selectedSize, variants]);

  const selectedVariant = useMemo(() => {
    if (!hasVariants) return null;
    if (selectedVariantId) {
      return variants.find((variant) => variant.id === selectedVariantId) ?? null;
    }
    if (filteredVariants.length === 1) return filteredVariants[0];
    return null;
  }, [filteredVariants, hasVariants, selectedVariantId, variants]);

  const hasValidVariantSelection = !hasVariants || Boolean(selectedVariant);
  const selectedVariantIdentifier = selectedVariant?.id ?? selectedVariant?.sku ?? null;
  const minimumVariantPriceCents = useMemo(() => {
    const prices = variants
      .map((variant) => variant.priceCents)
      .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
    if (!prices.length) return null;
    return Math.min(...prices);
  }, [variants]);

  const displayPriceCents =
    selectedVariant?.priceCents ?? product?.priceCents ?? minimumVariantPriceCents ?? null;
  const showPriceUnavailable = !hasVariants && (!displayPriceCents || displayPriceCents <= 0);
  const displayPriceLabel = showPriceUnavailable
    ? 'Price unavailable'
    : formatCurrency(
        typeof displayPriceCents === 'number' && Number.isFinite(displayPriceCents)
          ? displayPriceCents
          : 0
      );
  const photos = useMemo(
    () =>
      (Array.isArray(product?.listing_photos) ? product.listing_photos : [])
        .map((value) => resolveMediaUrl(value))
        .filter((value): value is string => Boolean(value)),
    [product?.listing_photos]
  );

  const mainImageUrl = photos[activeIdx] || '';

  const selectedVariantLabel = useMemo(() => {
    if (!selectedVariant) return null;
    const parts = [selectedVariant.size, selectedVariant.color, selectedVariant.sku].filter(Boolean);
    if (!parts.length) return null;
    return `Selected: ${parts.join(' / ')}`;
  }, [selectedVariant]);

  const qtyNum = Number(qty);
  const isLoading = status === 'loading';
  const isError = status === 'error';
  const isNotFound = status === 'not_found';

  const hasStock = Boolean(
    !hasVariants ||
      (selectedVariant &&
        (typeof selectedVariant.stock !== 'number' || selectedVariant.stock > 0))
  );

  const getVariantSelectionError = useCallback(() => {
    if (!hasVariants || hasValidVariantSelection) return null;
    return 'Please select a size/color before continuing.';
  }, [hasValidVariantSelection, hasVariants]);

  const addToCartDisabledReason = useMemo(() => {
    if (buyNowLoading) return 'pending_action';
    if (isLoading) return 'loading';
    if (getVariantSelectionError()) return 'missing_variant';
    if (qtyNum < 1) return 'invalid_qty';
    if (!hasStock) return 'out_of_stock';
    return 'ready';
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buyNowLoading, getVariantSelectionError, hasStock, isLoading, qtyNum]);

  const loadProduct = useCallback(async () => {
    if (!id) {
      setStatus('not_found');
      return;
    }
    setStatus('loading');
    setError(null);
    try {
      const payload = await fetchJson<any>(`/products/${id}`);
      const normalized = normalizePayload(payload, id);
      if (!normalized) {
        setStatus('not_found');
        return;
      }
      setProduct(normalized.product);
      setVariants(normalized.variants);
      setSelectedVariantId('');
      setSelectedSize('');
      setSelectedColor('');
      setSelectionError(null);
      setQty(1);
      setStatus('idle');
    } catch (err) {
      if ((err as any)?.status === 404) {
        setStatus('not_found');
        return;
      }
      setError(safeErrorMessage(err));
      setStatus('error');
    }
  }, [id]);

  useEffect(() => {
    loadProduct();
  }, [loadProduct]);

  useEffect(() => {
    if (product) {
      trackPageView('Product Detail');
    }
  }, [product]);

  useEffect(() => {
    setActiveIdx(0);
  }, [id]);

  useEffect(() => {
    if (activeIdx >= photos.length) {
      setActiveIdx(0);
    }
    setMainImageLoadError(false);
  }, [activeIdx, photos]);

  const { addItem } = useCart();
  const [cartFeedback, setCartFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (!cartFeedback) return undefined;
    const timer = setTimeout(() => setCartFeedback(null), 2000);
    return () => clearTimeout(timer);
  }, [cartFeedback]);

  const addSelectedVariantToCart = useCallback(() => {
    if (!id) return;
    addItem(
      {
        productId: id,
        variantId: selectedVariantIdentifier,
        title: product?.title ?? selectedVariant?.sku ?? 'Product',
        priceCents: displayPriceCents ?? 0,
        imageUrl: undefined,
      },
      qty
    );
  }, [addItem, displayPriceCents, id, product?.title, qty, selectedVariant?.sku, selectedVariantIdentifier]);

  const handleAddToCart = () => {
    const variantError = getVariantSelectionError();
    if (variantError) {
      setSelectionError(variantError);
      toast.notify(variantError, 'error');
      return;
    }
    setSelectionError(null);
    addSelectedVariantToCart();
    toast.notify('Added to cart', 'success');
    setCartFeedback('Added to cart');
  };

  const handleBuyNow = useCallback(async () => {
    const variantError = getVariantSelectionError();
    if (variantError) {
      setSelectionError(variantError);
      toast.notify(variantError, 'error');
      return;
    }
    setBuyNowLoading(true);
    try {
      setSelectionError(null);
      addSelectedVariantToCart();
      navigate('/cart');
    } finally {
      setBuyNowLoading(false);
    }
  }, [addSelectedVariantToCart, getVariantSelectionError, navigate, toast]);

  const handleCreateOrder = useCallback(async () => {
    if (!id) return;
    const variantError = getVariantSelectionError();
    if (variantError) {
      setSelectionError(variantError);
      toast.notify(variantError, 'error');
      return;
    }
    if (!Number.isFinite(qtyNum) || qtyNum < 1) {
      toast.notify('Please enter a valid quantity.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const items = hasVariants
        ? [
            {
              productId: id,
              productVariantId: selectedVariant?.id ?? selectedVariantIdentifier,
              quantity: qtyNum,
            },
          ]
        : [
            {
              productId: id,
              quantity: qtyNum,
            },
          ];
      const response = await apiFetch('/api/orders', {
        method: 'POST',
        body: { items },
      });

      const data = response?.data ?? response;
      const orderId =
        data?.id ??
        data?.orderId ??
        data?.order?.id ??
        response?.id ??
        response?.orderId ??
        response?.order?.id;

      if (!orderId) {
        throw new Error('Order created but id was missing.');
      }

      navigate(`/buyer/order/${orderId}`);
    } catch (err) {
      toast.notify(safeErrorMessage(err), 'error');
    } finally {
      setIsSubmitting(false);
    }
  }, [
    getVariantSelectionError,
    hasVariants,
    id,
    navigate,
    qtyNum,
    selectedVariant?.id,
    selectedVariantIdentifier,
    toast,
  ]);

  if (isNotFound) {
    return <NotFoundPage />;
  }

  return (
    <Page>
      <Container className="space-y-6">
        <div className="space-y-2">
          <p className="text-sm uppercase tracking-[0.4em] text-slate-400">Product</p>
          <h1 className="om-title" data-testid="product-title">
            {isLoading ? 'Loading product...' : product?.title?.trim() || `Product ${id ?? ''}`}
          </h1>
          {product?.description && (
            <p className="text-sm text-slate-300 leading-relaxed max-w-3xl">{product.description}</p>
          )}
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="om-card p-4">
            <div className="aspect-[4/3] w-full overflow-hidden rounded-xl bg-slate-900/40">
              {mainImageUrl && !mainImageLoadError ? (
                <img
                  src={mainImageUrl}
                  alt={product?.title || 'Product image'}
                  className="h-full w-full object-cover"
                  onError={() => setMainImageLoadError(true)}
                />
              ) : (
                <div className="h-full w-full bg-gradient-to-b from-white/20 to-transparent" aria-hidden />
              )}
            </div>
            <div className="mt-3 grid grid-cols-4 gap-2">
              {photos.length > 0 ? (
                photos.slice(0, 4).map((photoUrl, idx) => (
                  <button
                    key={`${photoUrl}-${idx}`}
                    type="button"
                    onClick={() => setActiveIdx(idx)}
                    className={`aspect-square overflow-hidden rounded-lg border ${
                      idx === activeIdx ? 'border-white/60' : 'border-white/20'
                    } bg-slate-900/40`}
                    aria-label={`View product photo ${idx + 1}`}
                  >
                    <img
                      src={photoUrl}
                      alt={`Product thumbnail ${idx + 1}`}
                      className="h-full w-full object-cover"
                    />
                  </button>
                ))
              ) : (
                <div className="col-span-4 flex h-16 items-center justify-center rounded-lg border border-white/20 bg-slate-900/40 text-xs uppercase tracking-[0.2em] text-slate-400">
                  No photos
                </div>
              )}
            </div>
          </div>

          <div className="">
            <div className="om-card p-6 space-y-4">
              {isLoading && <LoadingState message="Loading product information..." />}
              {isError && (
                <ErrorState message={error ?? 'Failed to load product'} onRetry={loadProduct} />
              )}

              {!isLoading && !isError && (
                <div className="space-y-1">
                  <p className="om-title text-3xl font-bold text-white">{displayPriceLabel}</p>
                  <p className="text-sm text-slate-300 leading-relaxed">
                    {selectedVariant?.size && `Size: ${selectedVariant.size}`}
                    {selectedVariant?.color && ` · Color: ${selectedVariant.color}`}
                    {!selectedVariant?.size &&
                      !selectedVariant?.color &&
                      selectedVariant?.sku &&
                      `SKU: ${selectedVariant.sku}`}
                  </p>
                  {selectedVariantLabel && <p className="text-xs text-slate-400">{selectedVariantLabel}</p>}
                </div>
              )}

              {hasVariants && !isLoading && !isError && (
                <div className="space-y-3 overflow-visible">
                  <div className="space-y-1">
                    <Label htmlFor="variant-select">Variant</Label>
                    <select
                      id="variant-select"
                      value={selectedVariantId}
                      onChange={(event) => {
                        const nextId = event.target.value;
                        setSelectedVariantId(nextId);
                        const nextVariant = variants.find((variant) => variant.id === nextId);
                        setSelectedSize(nextVariant?.size ?? '');
                        setSelectedColor(nextVariant?.color ?? '');
                        setSelectionError(null);
                      }}
                      className="ui-input w-full min-w-[240px] h-10 rounded-md border border-white/20 bg-neutral-900 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    >
                      <option value="">Select a variant</option>
                      {variants.map((variant) => (
                        <option key={variant.id} value={variant.id}>
                          {[variant.size, variant.color, variant.sku].filter(Boolean).join(' / ') || 'Variant'}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="variant-size-select">Size</Label>
                    <select
                      id="variant-size-select"
                      data-testid="variant-size"
                      value={selectedSize}
                      onChange={(event) => {
                        setSelectedSize(event.target.value);
                        setSelectedVariantId('');
                        setSelectionError(null);
                      }}
                      className="ui-input w-full min-w-[240px] h-10 rounded-md border border-white/20 bg-neutral-900 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      disabled={sizeOptions.length === 0}
                    >
                      <option value="">
                        {sizeOptions.length > 0 ? 'Select size' : 'No size options'}
                      </option>
                      {sizeOptions.map((size) => (
                        <option key={size} value={size}>
                          {size}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="variant-color-select">Color</Label>
                    <select
                      id="variant-color-select"
                      data-testid="variant-color"
                      value={selectedColor}
                      onChange={(event) => {
                        setSelectedColor(event.target.value);
                        setSelectedVariantId('');
                        setSelectionError(null);
                      }}
                      className="ui-input w-full min-w-[240px] h-10 rounded-md border border-white/20 bg-neutral-900 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      disabled={colorOptions.length === 0}
                    >
                      <option value="">
                        {colorOptions.length > 0 ? 'Select color' : 'No color options'}
                      </option>
                      {colorOptions.map((color) => (
                        <option key={color} value={color}>
                          {color}
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectionError && <p className="text-sm text-amber-300">{selectionError}</p>}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="qty-input">Quantity</Label>
                <Input
                  id="qty-input"
                  data-testid="qty"
                  type="number"
                  min="1"
                  value={qty}
                  onChange={(event) => {
                    const nextValue = Number(event.target.value);
                    setQty(Number.isFinite(nextValue) && nextValue > 0 ? Math.floor(nextValue) : 1);
                  }}
                  className="max-w-[120px] text-white bg-slate-900/60 border border-white/20 px-3 py-2 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
                />
              </div>

              <div className="flex flex-col gap-3">
                <button
                  data-testid="create-order"
                  type="button"
                  onClick={handleCreateOrder}
                  disabled={
                    isSubmitting ||
                    isLoading ||
                    Boolean(getVariantSelectionError()) ||
                    qtyNum < 1 ||
                    !hasStock
                  }
                  className="w-full om-btn om-focus bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-400 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSubmitting ? 'Creating order...' : 'Create Order'}
                </button>

                <button
                  type="button"
                  onClick={handleAddToCart}
                  disabled={
                    buyNowLoading ||
                    isLoading ||
                    Boolean(getVariantSelectionError()) ||
                    qtyNum < 1 ||
                    !hasStock
                  }
                  className="w-full om-btn om-focus bg-white/90 px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-white active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {buyNowLoading ? 'Processing...' : 'Add to cart'}
                </button>

                <button
                  data-testid="product-buy-now"
                  type="button"
                  onClick={handleBuyNow}
                  disabled={
                    buyNowLoading ||
                    isLoading ||
                    Boolean(getVariantSelectionError()) ||
                    qtyNum < 1 ||
                    !hasStock
                  }
                  className="w-full om-btn om-focus bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-400 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {buyNowLoading ? 'Processing...' : 'Buy now'}
                </button>

                {cartFeedback && <p className="text-sm text-emerald-300">{cartFeedback}</p>}
              </div>

              <div className="mt-4 text-xs uppercase tracking-[0.4em] text-slate-400">
                Secure checkout • Fast updates in Orders
              </div>
              {!isLoading && !isError && addToCartDisabledReason === 'missing_variant' && (
                <p className="text-xs text-slate-400">Choose a unique variant combination to continue.</p>
              )}
            </div>
          </div>
        </div>
      </Container>
    </Page>
  );
}
