import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { fetchJson } from '../shared/api/fetchJson';
import { useToast } from '../shared/components/ux/ToastHost';
import ErrorState from '../shared/components/ux/ErrorState';
import LoadingState from '../shared/components/ux/LoadingState';
import { trackPageView } from '../shared/lib/telemetry';
import Input from '../shared/ui/legacy/Input';
import Label from '../shared/ui/legacy/Label';
import { Container, Page } from '../shared/ui/Page';
import { useCart } from '../cart/CartContext';
import { NotFoundPage } from './ErrorPages';
import { safeErrorMessage } from '../shared/utils/safeError';

import {
  formatCurrency,
  normalizePayload,
  type Product,
  type Variant,
} from '../features/catalog/product-detail/ProductDetail.model';

type OptionMeta = {
  value: string;
  isSelectable: boolean;
  hasPurchasable: boolean;
};

const normalizeOption = (value: unknown) => String(value || '').trim();

const isVariantPurchasable = (variant: Variant | null | undefined): boolean => {
  if (!variant) return false;
  if (typeof variant.effectiveSellable === 'boolean') return variant.effectiveSellable;
  if (typeof variant.stock === 'number') return variant.stock > 0;
  return true;
};

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const [product, setProduct] = useState<Product | null>(null);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [status, setStatus] = useState<'loading' | 'idle' | 'error' | 'not_found'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [buyNowLoading, setBuyNowLoading] = useState(false);
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [selectedColor, setSelectedColor] = useState<string>('');
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [mainImageLoadError, setMainImageLoadError] = useState(false);

  const hasVariants = variants.length > 0;
  const sizeOptions = useMemo(
    () =>
      Array.from(
        new Set(
          variants
            .map((variant) => normalizeOption(variant.size))
            .filter((value) => value.length > 0)
        )
      ),
    [variants]
  );
  const colorOptions = useMemo(
    () =>
      Array.from(
        new Set(
          variants
            .map((variant) => normalizeOption(variant.color))
            .filter((value) => value.length > 0)
        )
      ),
    [variants]
  );

  const findMatchingVariant = useCallback(
    (size: string, color: string) => {
      const normalizedSize = normalizeOption(size);
      const normalizedColor = normalizeOption(color);
      if (!normalizedSize || !normalizedColor) return null;
      const matches = variants.filter(
        (variant) =>
          normalizeOption(variant.size) === normalizedSize &&
          normalizeOption(variant.color) === normalizedColor
      );
      if (!matches.length) return null;
      return matches.find((variant) => isVariantPurchasable(variant)) ?? matches[0];
    },
    [variants]
  );

  const buildSizeOptionMeta = useCallback(
    (activeColor: string): OptionMeta[] =>
      sizeOptions.map((size) => {
        const candidates = variants.filter((variant) => {
          if (normalizeOption(variant.size) !== size) return false;
          if (!activeColor) return true;
          return normalizeOption(variant.color) === activeColor;
        });
        return {
          value: size,
          isSelectable: candidates.length > 0,
          hasPurchasable: candidates.some((variant) => isVariantPurchasable(variant)),
        };
      }),
    [sizeOptions, variants]
  );

  const buildColorOptionMeta = useCallback(
    (activeSize: string): OptionMeta[] =>
      colorOptions.map((color) => {
        const candidates = variants.filter((variant) => {
          if (normalizeOption(variant.color) !== color) return false;
          if (!activeSize) return true;
          return normalizeOption(variant.size) === activeSize;
        });
        return {
          value: color,
          isSelectable: candidates.length > 0,
          hasPurchasable: candidates.some((variant) => isVariantPurchasable(variant)),
        };
      }),
    [colorOptions, variants]
  );

  const sizeOptionMeta = useMemo(
    () => buildSizeOptionMeta(selectedColor),
    [buildSizeOptionMeta, selectedColor]
  );
  const colorOptionMeta = useMemo(
    () => buildColorOptionMeta(selectedSize),
    [buildColorOptionMeta, selectedSize]
  );

  const pickPreferredOption = useCallback((options: OptionMeta[]) => {
    return (
      options.find((option) => option.isSelectable && option.hasPurchasable)?.value ??
      options.find((option) => option.isSelectable)?.value ??
      ''
    );
  }, []);

  const selectedVariant = useMemo(() => {
    if (!hasVariants) return null;
    const bySelection = findMatchingVariant(selectedSize, selectedColor);
    if (bySelection) return bySelection;
    if (variants.length === 1) return variants[0];
    return null;
  }, [findMatchingVariant, hasVariants, selectedColor, selectedSize, variants]);

  const selectedVariantIdentifier = selectedVariant?.id ?? null;
  const selectedVariantInStock = isVariantPurchasable(selectedVariant);
  const minimumVariantPriceCents = useMemo(() => {
    const source = variants.some((variant) => isVariantPurchasable(variant))
      ? variants.filter((variant) => isVariantPurchasable(variant))
      : variants;
    const prices = source
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
    () => (Array.isArray(product?.listingPhotoUrls) ? product.listingPhotoUrls : []),
    [product?.listingPhotoUrls]
  );

  const mainImageUrl = photos[activeIdx] || '';
  const qtyNum = Number(qty);
  const isLoading = status === 'loading';
  const isError = status === 'error';
  const isNotFound = status === 'not_found';

  const getVariantSelectionError = useCallback(() => {
    if (!hasVariants) return null;
    if (!selectedSize || !selectedColor) {
      return 'Select size and color before continuing.';
    }
    if (!selectedVariant) {
      return 'This size and color combination is unavailable.';
    }
    if (!selectedVariantInStock) {
      return 'This size and color is currently out of stock.';
    }
    return null;
  }, [hasVariants, selectedColor, selectedSize, selectedVariant, selectedVariantInStock]);

  const stockStatusText = useMemo(() => {
    if (!hasVariants) return 'Ready to ship';
    if (!selectedSize || !selectedColor) return 'Select size and color';
    if (!selectedVariant) return 'Combination unavailable';
    if (!selectedVariantInStock) return 'Out of stock';
    return 'In stock';
  }, [hasVariants, selectedColor, selectedSize, selectedVariant, selectedVariantInStock]);

  const addToCartDisabledReason = useMemo(() => {
    if (buyNowLoading) return 'pending_action';
    if (isLoading) return 'loading';
    if (qtyNum < 1) return 'invalid_qty';
    const selectionErrorMessage = getVariantSelectionError();
    if (selectionErrorMessage) {
      if (selectedVariant && !selectedVariantInStock) return 'out_of_stock';
      return 'missing_variant';
    }
    return 'ready';
  }, [
    buyNowLoading,
    getVariantSelectionError,
    isLoading,
    qtyNum,
    selectedVariant,
    selectedVariantInStock,
  ]);

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

  useEffect(() => {
    if (!hasVariants) return;
    const hasCurrentSelection =
      Boolean(selectedSize) &&
      Boolean(selectedColor) &&
      Boolean(findMatchingVariant(selectedSize, selectedColor));
    if (hasCurrentSelection) return;

    const defaultVariant =
      variants.find((variant) => isVariantPurchasable(variant)) ?? variants[0] ?? null;
    if (!defaultVariant) return;
    const nextSize = normalizeOption(defaultVariant.size);
    const nextColor = normalizeOption(defaultVariant.color);
    if (nextSize !== selectedSize) setSelectedSize(nextSize);
    if (nextColor !== selectedColor) setSelectedColor(nextColor);
  }, [findMatchingVariant, hasVariants, selectedColor, selectedSize, variants]);

  const { addItem } = useCart();
  const [cartFeedback, setCartFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (!cartFeedback) return undefined;
    const timer = setTimeout(() => setCartFeedback(null), 2000);
    return () => clearTimeout(timer);
  }, [cartFeedback]);

  const addSelectedVariantToCart = useCallback(() => {
    if (!id || !selectedVariantIdentifier) return;
    addItem(
      {
        productId: id,
        variantId: selectedVariantIdentifier,
        title: product?.title ?? 'Product',
        priceCents: displayPriceCents ?? 0,
        imageUrl: photos[0] ?? undefined,
      },
      qty
    );
  }, [addItem, displayPriceCents, id, photos, product?.title, qty, selectedVariantIdentifier]);

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

  if (isNotFound) {
    return <NotFoundPage />;
  }

  return (
    <Page>
      <Container className="space-y-6">
        <div className="space-y-2">
          <p className="text-sm uppercase tracking-[0.4em] text-slate-500 dark:text-slate-400">
            Product
          </p>
          <h1 className="om-title" data-testid="product-title">
            {isLoading ? 'Loading product...' : product?.title?.trim() || `Product ${id ?? ''}`}
          </h1>
          {product?.description && (
            <p className="max-w-3xl text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {product.description}
            </p>
          )}
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="om-card p-4">
            <div className="aspect-[4/3] w-full overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-900/40">
              {mainImageUrl && !mainImageLoadError ? (
                <img
                  src={mainImageUrl}
                  alt={product?.title || 'Product image'}
                  className="h-full w-full object-cover"
                  onError={() => setMainImageLoadError(true)}
                />
              ) : (
                <div
                  className="h-full w-full bg-gradient-to-b from-slate-200 to-transparent dark:from-white/20"
                  aria-hidden
                />
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
                      idx === activeIdx
                        ? 'border-indigo-500 dark:border-white/60'
                        : 'border-slate-200 dark:border-white/20'
                    } bg-slate-100 dark:bg-slate-900/40`}
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
                <div className="col-span-4 flex h-16 items-center justify-center rounded-lg border border-slate-200 bg-slate-100 text-xs uppercase tracking-[0.2em] text-slate-400 dark:border-white/20 dark:bg-slate-900/40">
                  No photos
                </div>
              )}
            </div>
          </div>

          <div className="om-card p-6">
            <div className="space-y-5">
              {isLoading && <LoadingState message="Loading product information..." />}
              {isError && (
                <ErrorState message={error ?? 'Failed to load product'} onRetry={loadProduct} />
              )}

              {!isLoading && !isError && (
                <div className="space-y-2">
                  <p className="om-title text-3xl font-bold text-slate-900 dark:text-white">
                    {displayPriceLabel}
                  </p>
                  {hasVariants && (
                    <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                      Size: {selectedSize || 'Select'} | Color: {selectedColor || 'Select'}
                    </p>
                  )}
                  <p
                    data-testid="pdp-stock-status"
                    className={`text-xs font-bold uppercase tracking-[0.22em] ${
                      stockStatusText === 'In stock'
                        ? 'text-emerald-500 dark:text-emerald-300'
                        : stockStatusText === 'Out of stock'
                          ? 'text-rose-500 dark:text-rose-300'
                          : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {stockStatusText}
                  </p>
                </div>
              )}

              {hasVariants && !isLoading && !isError && (
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="variant-size-select">Size</Label>
                    <select
                      id="variant-size-select"
                      data-testid="variant-size"
                      value={selectedSize}
                      onChange={(event) => {
                        const nextSize = normalizeOption(event.target.value);
                        setSelectedSize(nextSize);
                        const nextColorMeta = buildColorOptionMeta(nextSize);
                        const currentColorState = nextColorMeta.find(
                          (option) => option.value === selectedColor
                        );
                        if (
                          !selectedColor ||
                          !currentColorState?.isSelectable
                        ) {
                          setSelectedColor(pickPreferredOption(nextColorMeta));
                        }
                        setSelectionError(null);
                      }}
                      className="ui-input h-10 w-full min-w-[200px] rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-400 dark:border-white/20 dark:bg-neutral-900 dark:text-white"
                      disabled={sizeOptionMeta.length === 0}
                    >
                      <option value="">
                        {sizeOptionMeta.length > 0 ? 'Select size' : 'No size options'}
                      </option>
                      {sizeOptionMeta.map((size) => (
                        <option key={size.value} value={size.value} disabled={!size.isSelectable}>
                          {size.value}
                          {!size.isSelectable
                            ? ' (Unavailable)'
                            : !size.hasPurchasable
                              ? ' (Out of stock)'
                              : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="variant-color-select">Color</Label>
                    <select
                      id="variant-color-select"
                      data-testid="variant-color"
                      value={selectedColor}
                      onChange={(event) => {
                        const nextColor = normalizeOption(event.target.value);
                        setSelectedColor(nextColor);
                        const nextSizeMeta = buildSizeOptionMeta(nextColor);
                        const currentSizeState = nextSizeMeta.find(
                          (option) => option.value === selectedSize
                        );
                        if (
                          !selectedSize ||
                          !currentSizeState?.isSelectable
                        ) {
                          setSelectedSize(pickPreferredOption(nextSizeMeta));
                        }
                        setSelectionError(null);
                      }}
                      className="ui-input h-10 w-full min-w-[200px] rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-400 dark:border-white/20 dark:bg-neutral-900 dark:text-white"
                      disabled={colorOptionMeta.length === 0}
                    >
                      <option value="">
                        {colorOptionMeta.length > 0 ? 'Select color' : 'No color options'}
                      </option>
                      {colorOptionMeta.map((color) => (
                        <option key={color.value} value={color.value} disabled={!color.isSelectable}>
                          {color.value}
                          {!color.isSelectable
                            ? ' (Unavailable)'
                            : !color.hasPurchasable
                              ? ' (Out of stock)'
                              : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectionError && (
                    <p className="md:col-span-2 text-sm text-amber-500 dark:text-amber-300">
                      {selectionError}
                    </p>
                  )}
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
                    setQty(
                      Number.isFinite(nextValue) && nextValue > 0
                        ? Math.floor(nextValue)
                        : 1
                    );
                  }}
                  className="max-w-[120px] rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 dark:border-white/20 dark:bg-slate-900/60 dark:text-white"
                />
              </div>

              <div className="flex flex-col gap-3">
                <button
                  type="button"
                  onClick={handleAddToCart}
                  disabled={
                    buyNowLoading ||
                    isLoading ||
                    Boolean(getVariantSelectionError()) ||
                    qtyNum < 1
                  }
                  className="om-btn om-focus w-full bg-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-300 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white/90 dark:text-black dark:hover:bg-white"
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
                    qtyNum < 1
                  }
                  className="om-btn om-focus w-full bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-400 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {buyNowLoading ? 'Processing...' : 'Buy now'}
                </button>

                {cartFeedback && <p className="text-sm text-emerald-500 dark:text-emerald-300">{cartFeedback}</p>}
              </div>

              <div className="mt-4 text-xs uppercase tracking-[0.32em] text-slate-500 dark:text-slate-400">
                Secure checkout | Real-time order updates
              </div>
              {!isLoading && !isError && addToCartDisabledReason === 'missing_variant' && (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Choose a valid size and color combination to continue.
                </p>
              )}
              {!isLoading && !isError && addToCartDisabledReason === 'out_of_stock' && (
                <p className="text-xs text-rose-500 dark:text-rose-300">
                  This selection is out of stock right now.
                </p>
              )}
            </div>
          </div>
        </div>
      </Container>
    </Page>
  );
}
