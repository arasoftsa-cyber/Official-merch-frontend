import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { getAccessToken } from '../shared/auth/tokenStore';
import { getMe } from '../shared/api/appApi';
import { useCart } from '../cart/CartContext';
import { apiFetch } from '../shared/api/http';
import { fetchJson } from '../shared/api';

const formatCents = (cents: number) => `$${(cents / 100).toFixed(2)}`;
const cartLineKey = (productId: string, variantId?: string | null) =>
  `${productId}::${variantId ?? ''}`;

type VariantMeta = {
  size?: string;
  color?: string;
  sku?: string;
};

type ProductVariantsResponse = {
  variants?: Array<{
    id: string;
    size?: string;
    color?: string;
    sku?: string;
  }>;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function CartPage() {
  const navigate = useNavigate();
  const { items, cartCount, cartTotalCents, setQty, removeItem, clearCart } =
    useCart();
  const [role, setRole] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [loadingRole, setLoadingRole] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [variantMeta, setVariantMeta] = useState<Record<string, VariantMeta>>({});
  const loggedIn = Boolean(getAccessToken());

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      setRole(null);
      return;
    }
    setLoadingRole(true);
    getMe()
      .then((me) => {
        setRole(me?.role ?? me?.user?.role ?? null);
      })
      .catch(() => {
        setRole(null);
      })
      .finally(() => {
        setLoadingRole(false);
      });
  }, []);

  useEffect(() => {
    const itemsWithVariant = items.filter((item) => Boolean(item.variantId));
    if (itemsWithVariant.length === 0) {
      setVariantMeta({});
      return;
    }

    const uniqueProductIds = Array.from(
      new Set(itemsWithVariant.map((item) => item.productId))
    );
    let cancelled = false;

    const loadVariantMeta = async () => {
      const variantsByProduct: Record<string, ProductVariantsResponse['variants']> = {};

      await Promise.all(
        uniqueProductIds.map(async (productId) => {
          try {
            const payload = await fetchJson<ProductVariantsResponse>(`/products/${productId}`);
            variantsByProduct[productId] = Array.isArray(payload?.variants)
              ? payload.variants
              : [];
          } catch {
            variantsByProduct[productId] = [];
          }
        })
      );

      if (cancelled) return;

      const nextMeta: Record<string, VariantMeta> = {};
      itemsWithVariant.forEach((item) => {
        const variants = variantsByProduct[item.productId] ?? [];
        const matched = variants.find((variant) => variant.id === item.variantId);
        if (!matched) return;
        nextMeta[cartLineKey(item.productId, item.variantId)] = {
          size: matched.size,
          color: matched.color,
          sku: matched.sku,
        };
      });

      setVariantMeta(nextMeta);
    };

    loadVariantMeta();
    return () => {
      cancelled = true;
    };
  }, [items]);

  const cartIsEmpty = items.length === 0;

  const handleCheckout = async () => {
    if (items.length === 0) {
      setStatusMessage('Add something to the cart before checking out.');
      return;
    }
    if (!loggedIn) {
      navigate('/fan/login?returnTo=%2Fcart');
      return;
    }
    if ((role ?? '').toLowerCase() !== 'buyer') {
      window.location.assign('/forbidden');
      return;
    }
    if (items.some((entry) => !Number.isFinite(Number(entry.quantity)) || Number(entry.quantity) <= 0)) {
      setStatusMessage('Adjust quantities before placing an order.');
      return;
    }

    const uniqueProductIds = Array.from(new Set(items.map((entry) => String(entry.productId || '').trim()).filter(Boolean)));
    const productVariantsByProductId: Record<string, ProductVariantsResponse['variants']> = {};
    await Promise.all(
      uniqueProductIds.map(async (productId) => {
        try {
          const payload = await fetchJson<ProductVariantsResponse>(`/products/${productId}`);
          productVariantsByProductId[productId] = Array.isArray(payload?.variants) ? payload.variants : [];
        } catch {
          productVariantsByProductId[productId] = [];
        }
      })
    );

    const checkoutItems = items.map((entry) => {
      const productId = String(entry.productId || '').trim();
      const quantity = Number(entry.quantity);
      const rawVariant = String((entry.variantId ?? (entry as any)?.productVariantId ?? '') || '').trim();
      const variants = productVariantsByProductId[productId] ?? [];

      let resolvedVariantId: string | null = null;
      if (UUID_RE.test(rawVariant)) {
        resolvedVariantId = rawVariant;
      } else if (rawVariant) {
        const matchedBySku = variants.find(
          (variant) => String(variant?.sku || '').trim().toLowerCase() === rawVariant.toLowerCase()
        );
        if (matchedBySku?.id) {
          resolvedVariantId = matchedBySku.id;
        }
      }
      if (!resolvedVariantId && variants.length === 1 && variants[0]?.id) {
        resolvedVariantId = variants[0].id;
      }

      return {
        productId,
        productVariantId: resolvedVariantId,
        quantity,
      };
    });

    if (checkoutItems.some((entry) => !entry.productId || !entry.productVariantId)) {
      setStatusMessage('Select a variant before placing an order.');
      return;
    }

    setStatusMessage(null);
    setCheckoutLoading(true);
    setErrorMessage(null);

    const extractOrderId = (response: any): string | null => {
      if (!response) return null;
      if (typeof response?.orderId === 'string') return response.orderId;
      if (typeof response?.id === 'string') return response.id;
      if (typeof response?.order?.id === 'string') return response.order.id;
      if (typeof response?.order === 'string') return response.order;
      return null;
    };

    try {
      const response: any = await apiFetch('/api/orders', {
        method: 'POST',
        body: {
          items: checkoutItems.map((entry) => ({
            productId: entry.productId,
            productVariantId: entry.productVariantId,
            quantity: entry.quantity,
          })),
        },
      });
      const orderId =
        response?.orderId || response?.id || response?.order?.id || null;
      if (!orderId) {
        throw new Error('Order id missing from response');
      }
      clearCart();
      navigate(`/buyer/order/${orderId}`);
    } catch (err: any) {
      const detail = String(err?.message ?? '').trim();
      setErrorMessage(
        detail && !/^http_\d+$/i.test(detail)
          ? `Checkout failed. ${detail}`
          : 'Checkout failed. Please try again.'
      );
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handleIncrease = (itemId: string, variantId?: string | null) => {
    const item = items.find(
      (entry) =>
        entry.productId === itemId &&
        (entry.variantId ?? null) === (variantId ?? null)
    );
    if (item) {
      setQty(item.productId, item.variantId ?? null, item.quantity + 1);
    }
  };

  const handleDecrease = (itemId: string, variantId?: string | null) => {
    const item = items.find(
      (entry) =>
        entry.productId === itemId &&
        (entry.variantId ?? null) === (variantId ?? null)
    );
    if (item) {
      setQty(item.productId, item.variantId ?? null, item.quantity - 1);
    }
  };

  const subtotalLabel = useMemo(() => formatCents(cartTotalCents), [cartTotalCents]);

  const formatVariantSummary = (item: (typeof items)[number]) => {
    if (!item.variantId) return null;
    const meta = variantMeta[cartLineKey(item.productId, item.variantId)];
    if (!meta) return null;
    const sizeColor = [meta.size, meta.color].filter(Boolean).join('/');
    if (sizeColor && meta.sku) return `${sizeColor} (${meta.sku})`;
    if (sizeColor) return sizeColor;
    if (meta.sku) return `(${meta.sku})`;
    return null;
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 px-4 py-12">
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-semibold tracking-tight">Cart</h1>
          <p className="text-sm text-neutral-400">{cartCount} item(s)</p>
        </div>
        <Card className="space-y-6">
          {cartIsEmpty && (
            <p className="text-center text-sm text-neutral-400">Your cart is empty.</p>
          )}
          {!cartIsEmpty && (
            <div className="space-y-4">
              {items.map((item) => (
                <div
                  key={`${item.productId}-${item.variantId ?? 'single'}`}
                  className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <p className="text-lg font-semibold">
                      {item.title}
                      {formatVariantSummary(item) ? ` — ${formatVariantSummary(item)}` : ''}
                    </p>
                    <p className="text-sm text-neutral-400">
                      {formatCents(item.priceCents)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      className="rounded-full border border-white/20 px-3 py-1 text-[0.75rem] font-semibold"
                      onClick={() => handleDecrease(item.productId, item.variantId)}
                      aria-label="Decrease quantity"
                      disabled={item.quantity <= 1}
                    >
                      -
                    </Button>
                    <Input
                      readOnly
                      value={item.quantity}
                      className="w-12 text-center text-base bg-transparent border-transparent px-0"
                    />
                    <Button
                      type="button"
                      className="rounded-full border border-white/20 px-3 py-1 text-[0.75rem] font-semibold"
                      onClick={() => handleIncrease(item.productId, item.variantId)}
                      aria-label="Increase quantity"
                    >
                      +
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-neutral-400">
                      {formatCents(item.quantity * item.priceCents)}
                    </p>
                    <Button
                      type="button"
                      className="rounded-full border border-white/20 px-3 py-1 text-[0.75rem] font-semibold"
                      onClick={() => removeItem(item.productId, item.variantId)}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
              <div className="flex flex-col gap-3 border-t border-white/10 pt-4 text-right md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm text-neutral-400">Subtotal</p>
                  <p className="text-2xl font-semibold">{subtotalLabel}</p>
                </div>
                  <div className="flex flex-wrap gap-3">
                    <Button
                      type="button"
                      className="rounded-2xl border border-white/10 px-4 py-2 text-sm font-semibold"
                      onClick={clearCart}
                    >
                      Clear cart
                    </Button>
                    <Button
                      type="button"
                      className="rounded-2xl bg-white/90 px-4 py-2 text-sm font-semibold text-black"
                      onClick={handleCheckout}
                      disabled={cartIsEmpty || checkoutLoading}
                      aria-busy={checkoutLoading}
                    >
                      {checkoutLoading
                        ? 'Processing...'
                        : loggedIn
                          ? 'Checkout'
                          : 'Login to checkout'}
                    </Button>
                  </div>
              </div>
            </div>
          )}
          {statusMessage && (
            <div className="rounded-xl border border-yellow-400/30 bg-yellow-500/10 p-4 text-sm text-yellow-200">
              {statusMessage}
            </div>
          )}
          {errorMessage && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
              {errorMessage}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
