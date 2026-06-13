import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../shared/ui/legacy/Card';
import Button from '../shared/ui/legacy/Button';
import Input from '../shared/ui/legacy/Input';
import { useCart } from '../cart/CartContext';
import { apiFetch } from '../shared/api/http';
import { formatCurrencyFromCents } from '../shared/utils/formatting';
import { safeErrorMessage } from '../shared/utils/safeError';
import { useConfirm } from '../shared/ui/ConfirmService';
import { getRoleHomeRoute } from '../shared/auth/routingPolicy';
import { useCartAccessState } from '../cart/cartAccess';
import { getAddresses } from '../shared/api/addressesApi';

const formatCents = (cents: number) => formatCurrencyFromCents(cents);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function CartPage() {
  const navigate = useNavigate();
  const { items, cartCount, cartTotalCents, setQty, removeItem, clearCart } =
    useCart();
  const { confirm } = useConfirm();
  const { isAuthenticated: loggedIn, role, canUseCart } = useCartAccessState();
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [cartMutationLoading, setCartMutationLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!loggedIn) {
      navigate('/fan/login?returnTo=%2Fcart', { replace: true });
      return;
    }
    if (!canUseCart) {
      navigate(getRoleHomeRoute(role), { replace: true });
    }
  }, [canUseCart, loggedIn, navigate, role]);

  if (!loggedIn || !canUseCart) {
    return null;
  }

  const cartIsEmpty = items.length === 0;

  const runCartMutation = async (
    action: () => Promise<void>,
    fallbackMessage: string
  ) => {
    setErrorMessage(null);
    setCartMutationLoading(true);
    try {
      await action();
    } catch (err) {
      const detail = safeErrorMessage(err).trim();
      setErrorMessage(
        detail && !/^http_\d+$/i.test(detail) ? detail : fallbackMessage
      );
    } finally {
      setCartMutationLoading(false);
    }
  };

  const handleCheckout = async () => {
    if (items.length === 0) {
      setStatusMessage('Add something to the cart before checking out.');
      return;
    }
    if (!loggedIn) {
      navigate('/fan/login?returnTo=%2Fcart');
      return;
    }
    if (!canUseCart) {
      navigate(getRoleHomeRoute(role));
      return;
    }
    if (items.some((entry) => !Number.isFinite(Number(entry.quantity)) || Number(entry.quantity) <= 0)) {
      setStatusMessage('Adjust quantities before placing an order.');
      return;
    }

    const checkoutItems = items.map((entry) => {
      const productId = String(entry.productId || '').trim();
      const quantity = Number(entry.quantity);
      const rawVariant = String((entry.variantId ?? (entry as any)?.productVariantId ?? '') || '').trim();

      let resolvedVariantId: string | null = null;
      if (UUID_RE.test(rawVariant)) {
        resolvedVariantId = rawVariant;
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

    // Check if user has at least one saved address
    try {
      const addresses = await getAddresses();
      if (addresses.length === 0) {
        setCheckoutLoading(false);
        setErrorMessage('Please add a delivery address before checking out.');
        setTimeout(() => navigate('/fan/addresses'), 2000);
        return;
      }
    } catch (err) {
      setCheckoutLoading(false);
      setErrorMessage('Could not verify your saved addresses. Please try again.');
      return;
    }

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
      navigate(`/fan/orders/${orderId}`);
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

  const handleIncrease = (item: (typeof items)[number]) => {
    void runCartMutation(
      () => setQty(item, item.quantity + 1),
      'Could not update cart quantity.'
    );
  };

  const handleDecrease = (item: (typeof items)[number]) => {
    void runCartMutation(
      () => setQty(item, item.quantity - 1),
      'Could not update cart quantity.'
    );
  };

  const handleRemoveItem = async (item: (typeof items)[number]) => {
    const confirmed = await confirm({
      title: 'Remove item',
      message: `Remove ${item.title} from your cart?`,
      confirmText: 'Remove',
      cancelText: 'Keep item',
      danger: true,
    });

    if (!confirmed) {
      return;
    }

    await runCartMutation(
      () => removeItem(item),
      'Could not remove this item from your cart.'
    );
  };

  const subtotalLabel = useMemo(() => formatCents(cartTotalCents), [cartTotalCents]);

  const formatVariantSummary = (item: (typeof items)[number]) => {
    const meta = item.inventory;
    if (!meta) return null;
    const sizeColor = [meta.size, meta.color].filter(Boolean).join('/');
    if (sizeColor && meta.supplierSku) return `${sizeColor} (${meta.supplierSku})`;
    if (sizeColor) return sizeColor;
    if (meta.supplierSku) return `(${meta.supplierSku})`;
    return null;
  };

  return (
    <div className="min-h-screen px-4 py-12">
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
                  key={item.id ?? `${item.productId}-${item.variantId ?? 'single'}`}
                  className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <p className="text-lg font-semibold">
                      {item.title}
                      {formatVariantSummary(item) ? ` - ${formatVariantSummary(item)}` : ''}
                    </p>
                    <p className="text-sm text-neutral-400">
                      {formatCents(item.priceCents)}
                    </p>
                    {item.available === false && (
                      <p className="text-xs text-rose-300">
                        Unavailable right now
                        {item.availableStock && item.availableStock > 0
                          ? `, only ${item.availableStock} left`
                          : ''}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      className="rounded-full border border-white/20 px-3 py-1 text-[0.75rem] font-semibold"
                      onClick={() => handleDecrease(item)}
                      aria-label="Decrease quantity"
                      disabled={cartMutationLoading || item.quantity <= 1}
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
                      onClick={() => handleIncrease(item)}
                      aria-label="Increase quantity"
                      disabled={cartMutationLoading}
                    >
                      +
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-neutral-400">
                      {formatCents(item.lineTotalCents ?? item.quantity * item.priceCents)}
                    </p>
                    <Button
                      type="button"
                      className="rounded-full border border-white/20 px-3 py-1 text-[0.75rem] font-semibold"
                      onClick={() => {
                        void handleRemoveItem(item);
                      }}
                      disabled={cartMutationLoading}
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
                    onClick={() => {
                      void runCartMutation(
                        () => clearCart(),
                        'Could not clear your cart.'
                      );
                    }}
                    disabled={cartMutationLoading}
                  >
                    Clear cart
                  </Button>
                  <Button
                    type="button"
                    className="rounded-2xl bg-white/90 px-4 py-2 text-sm font-semibold text-black"
                    onClick={handleCheckout}
                    disabled={cartIsEmpty || cartMutationLoading || checkoutLoading}
                    aria-busy={checkoutLoading}
                  >
                    {checkoutLoading
                      ? 'Processing...'
                      : 'Checkout'}
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
