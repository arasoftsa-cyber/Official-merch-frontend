import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { apiFetch } from '../../../shared/api/http';
import { Container, Page } from '../../../shared/ui/Page';
import {
  formatCurrencyFromCents,
  formatDateTime as formatDateTimeValue,
} from '../../../shared/utils/formatting';

type ArtistSummary = {
  totalOrders?: number;
  totalUnits?: number;
  grossCents?: number;
  [key: string]: any;
};

type ArtistOrder = {
  id?: string;
  orderId?: string;
  status?: string;
  totalCents?: number;
  createdAt?: string;
  buyerUserId?: string;
  items?: Array<{
    productId?: string;
    productVariantId?: string;
    quantity?: number;
    priceCents?: number;
  }>;
  [key: string]: any;
};

type ArtistOrderDetailItem = {
  productId?: string;
  productTitle?: string;
  productVariantId?: string;
  variantSku?: string | null;
  variantSize?: string | null;
  variantColor?: string | null;
  quantity?: number;
  priceCents?: number;
  lineTotalCents?: number;
};

type ArtistOrderDetail = {
  id?: string;
  status?: string;
  totalCents?: number;
  createdAt?: string | null;
  items?: ArtistOrderDetailItem[];
};

const KNOWN_ARTIST_ORDER_STATUSES = [
  'placed',
  'paid',
  'captured',
  'fulfilled',
  'cancelled',
  'refunded',
];

const formatCurrency = (cents?: number) => {
  return formatCurrencyFromCents(cents);
};

const formatDateTime = (value?: string | null) => {
  if (!value) return '-';
  return formatDateTimeValue(value);
};

const normalizeOrderList = (payload: any): ArtistOrder[] => {
  if (Array.isArray(payload?.items)) {
    return payload.items;
  }
  if (Array.isArray(payload)) {
    return payload;
  }
  return [];
};

export function ArtistDashboardPage() {
  const navigate = useNavigate();
  const [summary, setSummary] = useState<ArtistSummary | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [orders, setOrders] = useState<ArtistOrder[]>([]);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [dropsCount, setDropsCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      setSummaryError(null);
      setOrdersError(null);
      try {
        const [summaryPayload, ordersPayload, dropsPayload] = await Promise.all([
          apiFetch('/api/artist/dashboard/summary'),
          apiFetch('/api/artist/dashboard/orders?status=all&range=30d&sort=default&limit=10'),
          apiFetch('/api/artist/drops'),
        ]);

        if (!active) return;
        setSummary(summaryPayload ?? null);
        setOrders(normalizeOrderList(ordersPayload));
        setDropsCount(normalizeOrderList(dropsPayload).length);
      } catch (err: any) {
        if (!active) return;
        const message = err?.message ?? 'Failed to load artist dashboard.';
        setSummaryError(message);
        setOrdersError(message);
        setDropsCount(0);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, []);

  return (
    <Page>
      <Container className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-slate-500 dark:text-slate-400">Artist</p>
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Artist Dashboard</h1>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-5">
          <button
            type="button"
            onClick={() => navigate('/partner/artist/orders')}
            className="cursor-pointer rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 p-4 text-left transition hover:border-slate-300 dark:hover:border-white/30 hover:bg-slate-100 dark:hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 dark:focus-visible:ring-white/50"
          >
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Orders</p>
            <p className="mt-2 text-2xl text-slate-900 dark:text-white">{loading ? '...' : summary?.totalOrders ?? '-'}</p>
          </button>
          <button
            type="button"
            onClick={() => navigate('/partner/artist/orders?metric=units')}
            className="cursor-pointer rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 p-4 text-left transition hover:border-slate-300 dark:hover:border-white/30 hover:bg-slate-100 dark:hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 dark:focus-visible:ring-white/50"
          >
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Units</p>
            <p className="mt-2 text-2xl text-slate-900 dark:text-white">{loading ? '...' : summary?.totalUnits ?? '-'}</p>
          </button>
          <button
            type="button"
            onClick={() => navigate('/partner/artist/orders?metric=gross')}
            className="cursor-pointer rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 p-4 text-left transition hover:border-slate-300 dark:hover:border-white/30 hover:bg-slate-100 dark:hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 dark:focus-visible:ring-white/50"
          >
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Gross</p>
            <p className="mt-2 text-2xl text-slate-900 dark:text-white">{loading ? '...' : formatCurrency(summary?.grossCents)}</p>
          </button>
          <button
            type="button"
            onClick={() => navigate('/partner/artist/products')}
            className="cursor-pointer rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 p-4 text-left transition hover:border-slate-300 dark:hover:border-white/30 hover:bg-slate-100 dark:hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 dark:focus-visible:ring-white/50"
          >
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Products</p>
            <p className="mt-2 text-2xl text-slate-900 dark:text-white">-</p>
          </button>
          <button
            type="button"
            onClick={() => navigate('/partner/artist/drops')}
            className="cursor-pointer rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 p-4 text-left transition hover:border-slate-300 dark:hover:border-white/30 hover:bg-slate-100 dark:hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 dark:focus-visible:ring-white/50"
          >
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Drops</p>
            <p className="mt-2 text-2xl text-slate-900 dark:text-white">{loading ? '...' : dropsCount}</p>
          </button>
        </div>

        {summaryError && (
          <p role="alert" className="mt-4 text-sm text-rose-600 dark:text-rose-300">
            Summary unavailable: {summaryError}
          </p>
        )}

        <section className="mt-8">
          <div className="mb-3">
            <h2 className="text-lg font-medium text-slate-900 dark:text-white">Recent Orders</h2>
          </div>
          {loading && <p className="text-slate-500 dark:text-slate-400">Loading recent orders...</p>}
          {!loading && ordersError && (
            <p role="alert" className="text-sm text-rose-600 dark:text-rose-300">
              Orders unavailable: {ordersError}
            </p>
          )}
          {!loading && !ordersError && orders.length === 0 && (
            <p className="text-sm text-slate-500 dark:text-slate-400">No recent orders yet.</p>
          )}
          {!loading && !ordersError && orders.length > 0 && (
            <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5">
              <table className="w-full text-left text-sm text-slate-900 dark:text-white">
                <thead className="bg-slate-50 dark:bg-transparent">
                  <tr className="border-b border-slate-200 dark:border-white/10 text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
                    <th className="px-4 py-3">Order</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Total</th>
                    <th className="px-4 py-3">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.slice(0, 10).map((order, index) => {
                    const orderId = order?.orderId ?? order?.id ?? '';
                    const target = orderId
                      ? `/partner/artist/orders/${orderId}`
                      : '/partner/artist/orders';
                    return (
                      <tr
                        key={orderId || `order-${index}`}
                        className="border-b border-slate-100 dark:border-white/5 transition hover:bg-slate-50 dark:hover:bg-white/10"
                      >
                        <td className="px-4 py-3 font-mono">
                          <Link className="underline decoration-transparent hover:decoration-current" to={target}>
                            {order?.orderId ?? order?.id ?? '-'}
                          </Link>
                        </td>
                        <td className="px-4 py-3">{order?.status ?? '-'}</td>
                        <td className="px-4 py-3">{formatCurrency(order?.totalCents)}</td>
                        <td className="px-4 py-3">{formatDateTime(order?.createdAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </Container>
    </Page>
  );
}

export function ArtistOrdersPage() {
  const location = useLocation();
  const [orders, setOrders] = useState<ArtistOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const metric = new URLSearchParams(location.search).get('metric');

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const payload = await apiFetch('/api/artist/dashboard/orders');
        if (!active) return;
        setOrders(normalizeOrderList(payload));
      } catch (err: any) {
        if (!active) return;
        setOrders([]);
        setError(err?.message ?? 'Failed to load artist orders');
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, []);

  const statusOptions = useMemo(() => {
    const dynamicStatuses = orders
      .map((order) => `${order?.status ?? ''}`.trim().toLowerCase())
      .filter(Boolean);
    const merged = Array.from(new Set([...KNOWN_ARTIST_ORDER_STATUSES, ...dynamicStatuses]));
    return ['all', ...merged];
  }, [orders]);

  const filteredOrders = useMemo(() => {
    const statusFiltered =
      statusFilter === 'all'
        ? orders
        : orders.filter(
            (order) => `${order?.status ?? ''}`.trim().toLowerCase() === statusFilter
          );

    if (metric === 'units') {
      return [...statusFiltered].sort((a, b) => {
        const aUnits = Array.isArray(a?.items)
          ? a.items.reduce((sum, item) => sum + Number(item?.quantity ?? 0), 0)
          : 0;
        const bUnits = Array.isArray(b?.items)
          ? b.items.reduce((sum, item) => sum + Number(item?.quantity ?? 0), 0)
          : 0;
        return bUnits - aUnits;
      });
    }

    if (metric === 'gross') {
      return [...statusFiltered].sort(
        (a, b) => Number(b?.totalCents ?? 0) - Number(a?.totalCents ?? 0)
      );
    }

    return statusFiltered;
  }, [orders, statusFilter, metric]);

  const metricHint =
    metric === 'units'
      ? 'Sorted by units'
      : metric === 'gross'
        ? 'Sorted by gross'
        : null;

  const totalHeaderClass =
    metric === 'gross' ? 'px-4 py-3 text-slate-900 dark:text-white' : 'px-4 py-3';

  return (
    <Page>
      <Container className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-slate-500 dark:text-slate-400">Artist</p>
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Artist Orders</h1>
          </div>
          <Link className="text-sm text-slate-600 dark:text-slate-300 underline" to="/partner/artist">
            Back to dashboard
          </Link>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <label htmlFor="artist-orders-status" className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
            Status
          </label>
          <select
            id="artist-orders-status"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="rounded-xl border border-slate-200 dark:border-white/15 bg-white dark:bg-white/5 px-3 py-2 text-sm text-slate-900 dark:text-white outline-none focus:border-slate-300 dark:focus:border-white/40"
          >
            {statusOptions.map((status) => (
              <option key={status} value={status} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                {status === 'all' ? 'All' : status}
              </option>
            ))}
          </select>
          {metricHint && (
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-white/60">{metricHint}</p>
          )}
        </div>

        <section className="mt-6">
          {loading && <p className="text-slate-500 dark:text-slate-400">Loading artist orders...</p>}
          {!loading && error && (
            <p role="alert" className="text-sm text-rose-600 dark:text-rose-300">
              Orders unavailable: {error}
            </p>
          )}
          {!loading && !error && filteredOrders.length === 0 && (
            <p className="text-sm text-slate-500 dark:text-slate-400">No orders found for this filter.</p>
          )}
          {!loading && !error && filteredOrders.length > 0 && (
            <div
              className="overflow-hidden rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5"
              data-testid="artist-orders-table"
            >
              <table className="w-full text-left text-sm text-slate-900 dark:text-white">
                <thead className="bg-slate-50 dark:bg-transparent">
                  <tr className="border-b border-slate-200 dark:border-white/10 text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
                    <th className="px-4 py-3">Order</th>
                    <th className="px-4 py-3">Status</th>
                    <th className={totalHeaderClass}>Total</th>
                    <th className="px-4 py-3">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map((order, index) => {
                    const orderId = order?.orderId ?? order?.id ?? `order-${index}`;
                    const orderHref = `/partner/artist/orders/${orderId}`;
                    return (
                      <tr
                        key={orderId}
                        data-testid="artist-orders-row"
                        className="border-b border-slate-100 dark:border-white/5 transition hover:bg-slate-50 dark:hover:bg-white/10"
                      >
                        <td className="px-4 py-3 font-mono">
                          <Link className="underline decoration-transparent hover:decoration-current" to={orderHref}>
                            {order?.orderId ?? order?.id ?? '-'}
                          </Link>
                        </td>
                        <td className="px-4 py-3">{order?.status ?? '-'}</td>
                        <td className="px-4 py-3">{formatCurrency(order?.totalCents)}</td>
                        <td className="px-4 py-3">{formatDateTime(order?.createdAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </Container>
    </Page>
  );
}

export function ArtistOrderDetailPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const [detail, setDetail] = useState<ArtistOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      if (!orderId) {
        setError('Missing order id');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const payload = await apiFetch(`/api/artist/dashboard/orders/${orderId}`);
        if (!active) return;
        setDetail(payload ?? null);
      } catch (err: any) {
        if (!active) return;
        setDetail(null);
        setError(err?.message ?? 'Failed to load artist order detail');
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [orderId]);

  return (
    <Page>
      <Container className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-slate-500 dark:text-slate-400">Artist</p>
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Artist Order Detail</h1>
          </div>
          <Link className="text-sm text-slate-600 dark:text-slate-300 underline" to="/partner/artist/orders">
            Back to artist orders
          </Link>
        </div>

        {loading && <p className="mt-6 text-slate-500 dark:text-slate-400">Loading order detail...</p>}
        {!loading && error && (
          <p role="alert" className="mt-6 text-sm text-rose-600 dark:text-rose-300">
            {error}
          </p>
        )}

        {!loading && !error && detail && (
          <section className="mt-6 space-y-4">
            <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Order ID</p>
              <p className="mt-2 font-mono text-sm text-slate-900 dark:text-white">{detail.id ?? '-'}</p>
              <div className="mt-3 grid gap-3 text-sm text-slate-600 dark:text-white/80 md:grid-cols-3">
                <p>Status: {detail.status ?? '-'}</p>
                <p>Created: {formatDateTime(detail.createdAt)}</p>
                <p>Total: {formatCurrency(detail.totalCents)}</p>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5">
              <div className="grid grid-cols-[1.6fr_1.2fr_0.8fr_1fr_1fr] gap-3 border-b border-slate-200 dark:border-white/10 px-4 py-3 text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-transparent">
                <span>Product</span>
                <span>Variant</span>
                <span>Qty</span>
                <span>Price</span>
                <span>Line total</span>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-white/10">
                {(detail.items ?? []).map((item, index) => {
                  const variantParts = [item.variantSku, item.variantSize, item.variantColor]
                    .filter(Boolean)
                    .join(' / ');
                  return (
                    <div
                      key={`${item.productId ?? 'item'}-${index}`}
                      className="grid grid-cols-[1.6fr_1.2fr_0.8fr_1fr_1fr] gap-3 px-4 py-3 text-sm text-slate-900 dark:text-white"
                    >
                      <span>{item.productTitle ?? item.productId ?? '-'}</span>
                      <span>{variantParts || item.productVariantId || '-'}</span>
                      <span>{item.quantity ?? 0}</span>
                      <span>{formatCurrency(item.priceCents)}</span>
                      <span>{formatCurrency(item.lineTotalCents)}</span>
                    </div>
                  );
                })}
                {(detail.items ?? []).length === 0 && (
                  <p className="px-4 py-4 text-sm text-slate-500 dark:text-slate-400">No line items available.</p>
                )}
              </div>
            </div>
          </section>
        )}
      </Container>
    </Page>
  );
}
