import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { apiGet, apiPost } from '../../lib/api';
import { getAccessToken } from '../../shared/auth/tokenStore';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { isUiTest } from '../../shared/uiTest';
import { Card } from '../../ui/Page';

type OrderDetail = Record<string, any>;

const money = (cents?: number | null) =>
  typeof cents === 'number' ? `₹${(cents / 100).toFixed(2)} ` : '—';

const shortId = (value?: string | null) =>
  value && value.length > 0 ? value.slice(0, 8) : '—';

const statusMap: Record<string, string> = {
  placed: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 ring-emerald-500/20',
  fulfilled: 'bg-sky-500/10 text-sky-600 dark:text-sky-200 ring-sky-500/30',
  cancelled: 'bg-rose-500/10 text-rose-600 dark:text-rose-200 ring-rose-500/30',
  refund: 'bg-amber-500/10 text-amber-600 dark:text-amber-200 ring-amber-500/30',
  pending: 'bg-slate-500/10 text-slate-600 dark:text-slate-200 ring-slate-500/30',
};

const statusClass = (status?: string) => {
  const normalized = status?.toLowerCase() ?? 'unknown';
  return statusMap[normalized] ?? 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-100 ring-slate-200 dark:ring-white/10';
};

export default function BuyerOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const token = getAccessToken();
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [payBusy, setPayBusy] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
  const [productTitles, setProductTitles] = useState<Record<string, string>>({});
  const [variantMeta, setVariantMeta] = useState<
    Record<string, { size?: string; color?: string; sku?: string }>
  >({});

  const loadData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const orderId = String(id).trim();
      const path = `/api/orders/${orderId}`;
      const eventsPath = `/api/orders/${orderId}/events`;
      const [detailPayload, eventsPayload] = await Promise.all([
        apiGet(path),
        apiGet(eventsPath).catch(() => []),
      ]);
      setDetail(detailPayload);
      const normalizedEvents = Array.isArray(eventsPayload)
        ? eventsPayload
        : Array.isArray((eventsPayload as any)?.items)
          ? (eventsPayload as any).items
          : [];
      setEvents(normalizedEvents);
    } catch (err: any) {
      setError(err?.message ?? 'Unable to load order');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  const cancelOrder = useCallback(async () => {
    if (!id) return;
    setActionBusy(true);
    setActionMessage(null);
    try {
      await apiPost(`/api/orders/${id}/cancel`);
      setActionMessage('Order cancelled');
      await loadData();
    } catch (err: any) {
      setActionMessage(err?.message ?? 'Cancel failed');
    } finally {
      setActionBusy(false);
    }
  }, [id, loadData]);

  const payNow = async () => {
    if (!id) return;
    setPayBusy(true);
    setPayError(null);
    try {
      const res: any = await apiPost(`/api/orders/${id}/pay`);
      const newAttemptId =
        res?.attemptId ??
        res?.paymentAttemptId ??
        res?.id ??
        res?.attempt?.id ??
        null;
      if (newAttemptId) {
        setAttemptId(newAttemptId);
      }
      await loadData();
    } catch (err: any) {
      setPayError(err?.message ?? 'Pay now failed');
    } finally {
      setPayBusy(false);
    }
  };

  const confirmPayment = async () => {
    if (!id || !attemptId) return;
    setPayBusy(true);
    setPayError(null);
    try {
      await apiPost(`/api/payments/mock/confirm/${attemptId}`);
      await loadData();
    } catch (err: any) {
      setPayError(err?.message ?? 'Mock confirm failed');
    } finally {
      setPayBusy(false);
    }
  };

  const detailItems = useMemo(
    () => (Array.isArray(detail?.items) ? detail.items : []),
    [detail?.items]
  );
  const status = detail?.status ?? detail?.state ?? detail?.orderStatus;
  const totalCents =
    typeof detail?.totalCents === 'number'
      ? detail.totalCents
      : typeof detail?.amount === 'number'
        ? Math.round(detail.amount * 100)
        : null;
  const formattedTotal =
    totalCents !== null ? `₹${(totalCents / 100).toFixed(2)}` : '—';
  const paymentStatus = useMemo(() => {
    if (!detail) return 'unpaid';
    if (detail?.payment?.status) return detail.payment.status;
    if (detail?.paymentStatus) return detail.paymentStatus;
    if (detail?.payment?.state) return detail.payment.state;
    if (detail?.payment?.paymentStatus) return detail.payment.paymentStatus;
    if (detail?.status === 'paid') return 'paid';
    return 'unpaid';
  }, [detail]);
  const derivedAttemptId = useMemo(() => {
    if (!detail) return null;
    return (
      detail?.paymentAttemptId ??
      detail?.payment_attempt_id ??
      detail?.payment?.attemptId ??
      detail?.payment?.paymentAttemptId ??
      detail?.attemptId ??
      null
    );
  }, [detail]);
  useEffect(() => {
    if (derivedAttemptId) {
      setAttemptId(String(derivedAttemptId));
    }
  }, [derivedAttemptId]);
  const isPaid = paymentStatus === 'paid';
  const isPending = paymentStatus === 'pending' || paymentStatus === 'processing';

  const timelineEvents = useMemo(() => {
    const candidate =
      detail?.events ??
      detail?.orderEvents ??
      detail?.order?.events ??
      detail?.order?.orderEvents;
    const normalized = Array.isArray(candidate)
      ? candidate
      : Array.isArray(events)
        ? events
        : [];
    const withTimestamp = normalized.map((event) => ({
      ...event,
      __type:
        event?.type ||
        event?.event ||
        event?.action ||
        event?.status ||
        'event',
      __ts:
        event?.at ||
        event?.createdAt ||
        event?.created_at ||
        event?.timestamp ||
        event?.time ||
        null,
    }));
    if (withTimestamp.length === 0 && detail?.createdAt) {
      return [
        {
          __type: 'placed',
          __ts: detail.createdAt,
          note: 'Order placed',
        },
      ];
    }

    return withTimestamp
      .sort((a, b) => {
        if (a.__ts && b.__ts) {
          return new Date(b.__ts).getTime() - new Date(a.__ts).getTime();
        }
        return 0;
      })
      .map((event) => event);
  }, [detail, events]);

  const eventBadgeClass = (eventType?: string) => {
    const normalized = (eventType ?? '').toLowerCase();
    if (normalized.includes('placed')) return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 ring-emerald-500/20';
    if (normalized.includes('paid')) return 'bg-sky-500/10 text-sky-600 dark:text-sky-200 ring-sky-500/30';
    if (normalized.includes('cancel')) return 'bg-rose-500/10 text-rose-600 dark:text-rose-200 ring-rose-500/30';
    if (normalized.includes('fulfill')) return 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-200 ring-indigo-500/30';
    if (normalized.includes('refund')) return 'bg-amber-500/10 text-amber-600 dark:text-amber-200 ring-amber-500/30';
    return 'bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-100 ring-slate-200 dark:ring-white/10';
  };

  const formatEventTimestamp = (value?: string | null) => {
    if (!value) return 'Unknown time';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleString();
  };

  useEffect(() => {
    const uniqueProductIds = Array.from(
      new Set(
        detailItems
          .map((item: any) => item?.productId)
          .filter((value: any): value is string => typeof value === 'string' && value.length > 0)
      )
    );

    if (!uniqueProductIds.length) {
      setProductTitles({});
      setVariantMeta({});
      return;
    }

    let cancelled = false;

    const loadItemMetadata = async () => {
      const nextTitles: Record<string, string> = {};
      const nextVariants: Record<string, { size?: string; color?: string; sku?: string }> = {};

      await Promise.all(
        uniqueProductIds.map(async (productId) => {
          try {
            const payload: any = await apiGet(`/api/products/${productId}`);
            const title =
              payload?.product?.title ??
              payload?.product?.name ??
              payload?.title ??
              payload?.name ??
              null;
            if (typeof title === 'string' && title.trim()) {
              nextTitles[productId] = title.trim();
            }

            const variants = Array.isArray(payload?.variants)
              ? payload.variants
              : Array.isArray(payload?.product?.variants)
                ? payload.product.variants
                : [];
            variants.forEach((variant: any) => {
              const variantId = variant?.id;
              if (!variantId || typeof variantId !== 'string') return;
              nextVariants[variantId] = {
                size: variant?.size,
                color: variant?.color,
                sku: variant?.sku,
              };
            });
          } catch {
            // Keep ID fallbacks when metadata fetch fails.
          }
        })
      );

      if (cancelled) return;
      setProductTitles(nextTitles);
      setVariantMeta(nextVariants);
    };

    loadItemMetadata();
    return () => {
      cancelled = true;
    };
  }, [detailItems]);

  const formatProductLabel = (item: any) => {
    const productId = item?.productId;
    if (typeof productId === 'string' && productTitles[productId]) {
      return productTitles[productId];
    }
    return `Product ${shortId(productId)}`;
  };

  const formatVariantLabel = (item: any) => {
    const variantId = item?.productVariantId;
    if (!variantId) return '—';

    const mapped =
      typeof variantId === 'string'
        ? variantMeta[variantId]
        : undefined;
    const size = item?.size ?? item?.variantSize ?? mapped?.size;
    const color = item?.color ?? item?.variantColor ?? mapped?.color;
    const sku = item?.sku ?? item?.variantSku ?? mapped?.sku;
    const sizeColor = [size, color].filter(Boolean).join('/');

    if (sizeColor && sku) return `${sizeColor} (${sku})`;
    if (sizeColor) return sizeColor;
    if (sku) return String(sku);
    return shortId(variantId);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <p className="text-sm uppercase tracking-[0.4em] text-slate-500 dark:text-slate-400">Order</p>
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-white">Order {id}</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <p className="text-sm uppercase tracking-[0.4em] text-slate-500 dark:text-slate-400">Order</p>
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-white">Order {id}</h1>
        <Card className="p-4 border-rose-200 bg-rose-50 dark:border-rose-500/20 dark:bg-rose-500/5">
          <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">
            {error}
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <p className="text-sm uppercase tracking-[0.4em] text-slate-500 dark:text-slate-400">Order</p>
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-white">Order {detail?.id ?? detail?.orderId ?? id}</h1>
      </div>

      {actionMessage && (
        <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm text-emerald-800 dark:text-emerald-100">
          {actionMessage}
        </div>
      )}

      <div className="space-y-5">
        <Card className="p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-slate-500 dark:text-slate-400">Status</p>
              <div className="mt-2 flex items-center gap-2">
                <span className="inline-flex h-2 w-2 rounded-full bg-slate-400 dark:bg-white/70" />
                <span
                  data-testid="order-status"
                  className={`inline-flex items-center rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] ${statusClass(
                    status
                  )}`}
                >
                  {status}
                </span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-[0.4em] text-slate-500 dark:text-slate-400">Payment</p>
              <p className="mt-1 text-sm font-semibold text-slate-700 dark:text-slate-300">{paymentStatus.toUpperCase()}</p>
            </div>
          </div>
          <p className="mt-6 text-sm text-slate-600 dark:text-slate-300">
            Total: <span className="text-lg font-bold text-slate-900 dark:text-white">{formattedTotal}</span>
          </p>

          <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
            {!isPaid && (
              <button
                data-testid="pay-now"
                disabled={payBusy}
                onClick={payNow}
                className="rounded-full bg-indigo-600 px-6 py-2.5 text-xs font-bold uppercase tracking-widest text-white transition hover:bg-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300/60 active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed"
              >
                Pay now
              </button>
            )}
            {!isPaid && (isPending || attemptId) && (
              <button
                data-testid="pay-mock-confirm"
                disabled={payBusy}
                onClick={confirmPayment}
                className="rounded-full border border-slate-300 dark:border-white/30 px-6 py-2.5 text-xs font-bold uppercase tracking-widest text-slate-700 dark:text-white transition hover:border-slate-900 hover:bg-slate-900 hover:text-white dark:hover:border-white dark:hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300/60 active:scale-[0.99] disabled:cursor-not-allowed"
              >
                Confirm payment (mock)
              </button>
            )}
            <button
              data-testid="order-cancel"
              onClick={() => {
                if (isUiTest) {
                  cancelOrder();
                } else {
                  setCancelConfirmOpen(true);
                }
              }}
              disabled={actionBusy}
              className="rounded-full border border-rose-300 dark:border-rose-500/40 px-6 py-2.5 text-xs font-bold uppercase tracking-widest text-rose-600 transition hover:bg-rose-50 dark:hover:border-rose-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300/60 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel order
            </button>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Events</h2>
          <div className="mt-6 space-y-4">
            {timelineEvents.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-white/60">No events recorded yet.</p>
            ) : (
              timelineEvents.map((event, idx) => (
                <div key={`event-${idx}`} className="flex items-start gap-4 text-sm">
                  <div className="flex flex-col items-center">
                    <span className="h-2 w-2 rounded-full bg-slate-300 dark:bg-white/70" />
                    {idx < timelineEvents.length - 1 && (
                      <span className="mt-1 h-8 w-px bg-slate-200 dark:bg-white/10" />
                    )}
                  </div>
                  <div>
                    <p>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.2em] ring-1 ${eventBadgeClass(
                          event?.__type
                        )}`}
                      >
                        {event?.__type ?? 'event'}
                      </span>
                    </p>
                    <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                      {formatEventTimestamp(event.__ts)}
                    </p>
                    {event?.reason && (
                      <p className="mt-1 text-xs text-slate-600 dark:text-white/60">Reason: {event.reason}</p>
                    )}
                    {event?.note && (
                      <p className="mt-1 text-xs text-slate-600 dark:text-white/60">Note: {event.note}</p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      {detailItems.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Items</h2>
          <div className="hidden border-b border-slate-200 pb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 dark:border-white/10 md:grid md:grid-cols-[1fr_1fr_0.5fr_0.8fr_0.9fr] md:gap-4 px-4">
            <span>Item</span>
            <span>Variant</span>
            <span>Qty</span>
            <span>Price</span>
            <span className="text-right">Line total</span>
          </div>
          <div className="space-y-2">
            {detailItems.map((item: any) => (
              <div
                key={item.id || `${item.productId}-${item.productVariantId}`}
                className="grid gap-2 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 md:grid-cols-[1fr_1fr_0.5fr_0.8fr_0.9fr] md:p-4"
              >
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 md:hidden">Item</span>
                  <span className="font-semibold">{formatProductLabel(item)}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 md:hidden">Variant</span>
                  <span className="text-xs">{formatVariantLabel(item)}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 md:hidden">Qty</span>
                  <span>{item.quantity ?? '—'}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 md:hidden">Price</span>
                  <span>{money(item.priceCents)}</span>
                </div>
                <div className="flex flex-col gap-1 md:text-right">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 md:hidden">Line Total</span>
                  <span className="font-bold">{money((item.priceCents ?? 0) * (item.quantity ?? 0))}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4 px-4 text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
            <span>Items: {detail?.items?.length ?? 0}</span>
            <span className="text-sm">Order total: <span className="text-lg text-slate-900 dark:text-white">{money(totalCents)}</span></span>
          </div>
        </section>
      )}

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Detail</h2>
          <button
            type="button"
            className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-400 transition hover:text-slate-900 dark:hover:text-white"
            onClick={() => setShowRaw((prev) => !prev)}
          >
            {showRaw ? 'Hide raw JSON' : 'Show raw JSON'}
          </button>
        </div>
        {showRaw && (
          <pre className="max-h-60 overflow-auto rounded-2xl border border-slate-200 bg-slate-50 p-6 text-xs text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
            {JSON.stringify(detail, null, 2)}
          </pre>
        )}
      </section>

      <ConfirmDialog
        open={cancelConfirmOpen}
        title="Cancel order"
        message="Are you sure you want to cancel this order?"
        confirmText="Confirm"
        cancelText="Back"
        danger
        onCancel={() => setCancelConfirmOpen(false)}
        onConfirm={async () => {
          setCancelConfirmOpen(false);
          await cancelOrder();
        }}
      />
    </div>
  );
}
