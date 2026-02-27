import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Routes,
  Route,
  Navigate,
  Outlet,
  Link,
  useLocation,
  useParams,
  useNavigate,
} from 'react-router-dom';
import Smoke from '../pages/Smoke';
import { apiFetch } from '../shared/api/http';
import { getAccessToken, clearTokens } from '../shared/auth/tokenStore';
import { API_BASE } from '../shared/api/http';
import { getMe, getConfig } from '../shared/api/appApi';
import FanLoginPage from '../pages/fan/FanLoginPage';
import FanRegisterPage from '../pages/fan/FanRegisterPage';
import PartnerLoginPage from '../pages/partner/PartnerLoginPage';
import CartPage from '../pages/CartPage';
import LabelDashboard from '../dashboards/label/LabelDashboard';
import LabelArtistDetailPage from '../dashboards/label/LabelArtistDetailPage';
import AdminDashboard from '../dashboards/admin/AdminDashboard';
import AdminOrderDetail from '../dashboards/admin/AdminOrderDetail';
import { ForbiddenPage, NotFoundPage } from '../pages/Errors';
import { safeErrorMessage } from '../shared/utils/safeError';
import AdminOrders from '../dashboards/admin/AdminOrders';
import AdminArtistRequests from '../dashboards/admin/AdminArtistRequests';
import AdminProductsPage from '../dashboards/admin/AdminProductsPage';
import AdminCreateProductPage from '../dashboards/admin/AdminCreateProductPage';
import AdminProductVariants from '../dashboards/admin/AdminProductVariants';
import AdminDropsPage from '../dashboards/admin/AdminDropsPage';
import AdminProvisioningPage from '../pages/admin/AdminProvisioningPage';
import AdminLeadsPage from '../pages/admin/AdminLeadsPage';
import AdminArtistsPage from '../pages/admin/AdminArtistsPage';
import AdminArtistDetailPage from '../pages/admin/AdminArtistDetailPage';
import BuyerOrdersPage from '../pages/buyer/BuyerOrdersPage';
import BuyerOrderDetailPage from '../pages/buyer/BuyerOrderDetailPage';
import BuyerLayout from '../pages/buyer/BuyerLayout';
import BuyerDashboardPage from '../pages/buyer/BuyerDashboardPage';
import BuyerAddressesPage from '../pages/buyer/BuyerAddressesPage';
import BuyerPaymentMethodsPage from '../pages/buyer/BuyerPaymentMethodsPage';
import ArtistProductsPage from '../pages/artist/ArtistProductsPage';
import ArtistProductVariantsPage from '../pages/artist/ArtistProductVariantsPage';
import PublicLayout from '../shared/layout/PublicLayout';
import ArtistDropsPage from '../pages/artist/ArtistDropsPage';
import LandingPage from '../pages/LandingPage';
import ProductsPage from '../pages/ProductsPage';
import ProductDetail from '../pages/ProductDetail';
import ArtistPage from '../pages/ArtistPage';
import DropPage from '../pages/DropPage';
import ApplyArtistPage from '../pages/ApplyArtistPage';
import ArtistsPage from '../pages/ArtistsPage';
import DropsPage from '../pages/DropsPage';
import LogoutPage from '../pages/LogoutPage';
import RedirectPage from '../pages/RedirectPage';
import { ToastProvider } from '../components/ux/ToastHost';
import { CartProvider } from '../cart/CartContext';

const LOGIN_PATHS = ['/fan/login', '/partner/login', '/login'];
const AUTH_BYPASS_PATHS = [...LOGIN_PATHS, '/logout'];
const LOGIN_CONTEXT_KEY = 'om_login_context';

function isExactPath(pathname: string, candidate: string): boolean {
  return pathname === candidate || pathname === `${candidate}/`;
}

function isLoginPath(pathname: string): boolean {
  return LOGIN_PATHS.some((path) => isExactPath(pathname, path));
}

function isAuthBypassPath(pathname: string): boolean {
  return AUTH_BYPASS_PATHS.some((path) => isExactPath(pathname, path));
}

function roleHomePath(role: string | null): string {
  const roleNorm = (role || '').toLowerCase();
  if (roleNorm === 'admin') return '/partner/admin';
  if (roleNorm === 'label') return '/partner/label';
  if (roleNorm === 'artist') return '/partner/artist';
  return '/fan';
}

function getRequestedLoginPath(search: string): string | null {
  const params = new URLSearchParams(search);
  const raw = params.get('returnTo') || params.get('returnUrl') || params.get('next') || '';
  if (!raw) return null;
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    decoded = raw;
  }
  if (!decoded.startsWith('/') || decoded.startsWith('//')) return null;
  return decoded;
}

function getPathnameOnly(candidate: string): string {
  return candidate.split(/[?#]/)[0] || '/';
}

function roleAllowsPath(role: string | null, path: string): boolean {
  if (isAuthBypassPath(path)) return true;
  const roleNorm = (role || '').toLowerCase();
  if (!roleNorm) return false;
  if (path.startsWith('/partner/admin')) {
    return roleNorm === 'admin';
  }
  if (path.startsWith('/partner/artist')) {
    return roleNorm === 'artist' || roleNorm === 'admin';
  }
  if (path.startsWith('/partner/label')) {
    return roleNorm === 'label' || roleNorm === 'admin';
  }
  if (path.startsWith('/partner')) {
    return roleNorm === 'artist' || roleNorm === 'label' || roleNorm === 'admin';
  }
  if (path.startsWith('/fan')) return Boolean(roleNorm);
  if (path.startsWith('/admin')) return roleNorm === 'admin';
  if (path.startsWith('/artist')) return roleNorm === 'artist' || roleNorm === 'admin';
  if (path.startsWith('/label')) return roleNorm === 'label' || roleNorm === 'admin';
  if (path.startsWith('/buyer')) return roleNorm === 'buyer';
  return true;
}

function getPostLoginRedirect({
  loginContext,
  next,
  role,
}: {
  loginContext: string | null;
  next: string | null;
  role: string | null;
}): string {
  const requested = next ?? '';
  const nextPath = requested ? getPathnameOnly(requested) : '';

  if (loginContext === 'fan') {
    const canUseNext =
      Boolean(requested) &&
      requested.startsWith('/') &&
      !requested.startsWith('//') &&
      !nextPath.startsWith('/partner');
    return canUseNext ? requested : '/fan';
  }

  const canUsePartnerNext =
    Boolean(requested) &&
    nextPath.startsWith('/partner') &&
    roleAllowsPath(role, nextPath);
  if (canUsePartnerNext) {
    return requested;
  }

  return roleHomePath(role);
}

function DashboardPlaceholder({ title }: { title: string }) {
  return (
    <main>
      <h1>{title}</h1>
      <p>Projection-only dashboard placeholder.</p>
    </main>
  );
}

function StatusPage() {
  return (
    <main>
      <h1>Status</h1>
      <p>API Base: {API_BASE}</p>
      <p>OK</p>
    </main>
  );
}

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

const KNOWN_ARTIST_ORDER_STATUSES = [
  'placed',
  'paid',
  'captured',
  'fulfilled',
  'cancelled',
  'refunded',
];

function ArtistDashboard() {
  const navigate = useNavigate();
  const [summary, setSummary] = useState<ArtistSummary | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [orders, setOrders] = useState<ArtistOrder[]>([]);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [dropsCount, setDropsCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
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
        const orderItems = Array.isArray(ordersPayload?.items)
          ? ordersPayload.items
          : Array.isArray(ordersPayload)
          ? ordersPayload
          : [];
        setOrders(orderItems);
        const dropItems = Array.isArray(dropsPayload?.items)
          ? dropsPayload.items
          : Array.isArray(dropsPayload)
          ? dropsPayload
          : [];
        setDropsCount(dropItems.length);
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
    })();
    return () => {
      active = false;
    };
  }, []);

  const formatCurrency = (cents?: number) => {
    if (typeof cents !== 'number' || !Number.isFinite(cents)) return '-';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 2,
    }).format(cents / 100);
  };

  return (
    <main>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Artist</p>
          <h1 className="text-2xl font-semibold text-white">Artist Dashboard</h1>
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-5">
        <button
          type="button"
          onClick={() => navigate('/partner/artist/orders')}
          className="cursor-pointer rounded-2xl border border-white/10 bg-white/5 p-4 text-left transition hover:border-white/30 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
        >
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Orders</p>
          <p className="mt-2 text-2xl text-white">{loading ? '...' : summary?.totalOrders ?? '-'}</p>
        </button>
        <button
          type="button"
          onClick={() => navigate('/partner/artist/orders?metric=units')}
          className="cursor-pointer rounded-2xl border border-white/10 bg-white/5 p-4 text-left transition hover:border-white/30 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
        >
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Units</p>
          <p className="mt-2 text-2xl text-white">{loading ? '...' : summary?.totalUnits ?? '-'}</p>
        </button>
        <button
          type="button"
          onClick={() => navigate('/partner/artist/orders?metric=gross')}
          className="cursor-pointer rounded-2xl border border-white/10 bg-white/5 p-4 text-left transition hover:border-white/30 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
        >
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Gross</p>
          <p className="mt-2 text-2xl text-white">{loading ? '...' : formatCurrency(summary?.grossCents)}</p>
        </button>
        <button
          type="button"
          onClick={() => navigate('/partner/artist/products')}
          className="cursor-pointer rounded-2xl border border-white/10 bg-white/5 p-4 text-left transition hover:border-white/30 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
        >
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Products</p>
          <p className="mt-2 text-2xl text-white">—</p>
        </button>
        <button
          type="button"
          onClick={() => navigate('/partner/artist/drops')}
          className="cursor-pointer rounded-2xl border border-white/10 bg-white/5 p-4 text-left transition hover:border-white/30 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
        >
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Drops</p>
          <p className="mt-2 text-2xl text-white">{loading ? '...' : dropsCount}</p>
        </button>
      </div>

      {summaryError && (
        <p role="alert" className="mt-4 text-sm text-rose-300">
          Summary unavailable: {summaryError}
        </p>
      )}

      <section className="mt-8">
        <div className="mb-3">
          <h2 className="text-lg font-medium text-white">Recent Orders</h2>
        </div>
        {loading && <p className="text-slate-400">Loading recent orders...</p>}
        {!loading && ordersError && (
          <p role="alert" className="text-sm text-rose-300">
            Orders unavailable: {ordersError}
          </p>
        )}
        {!loading && !ordersError && orders.length === 0 && (
          <p className="text-sm text-slate-400">No recent orders yet.</p>
        )}
        {!loading && !ordersError && orders.length > 0 && (
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
            <table className="w-full text-left text-sm text-white">
              <thead>
                <tr className="border-b border-white/10 text-xs uppercase tracking-[0.3em] text-slate-400">
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
                    className="cursor-pointer border-b border-white/5 transition hover:bg-white/10 focus-visible:bg-white/10"
                    role="button"
                    tabIndex={0}
                    onClick={() => navigate(target)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        navigate(target);
                      }
                    }}
                  >
                    <td className="px-4 py-3">{order?.orderId ?? order?.id ?? '-'}</td>
                    <td className="px-4 py-3">{order?.status ?? '-'}</td>
                    <td className="px-4 py-3">{formatCurrency(order?.totalCents)}</td>
                    <td className="px-4 py-3">{order?.createdAt ?? '-'}</td>
                  </tr>
                )})}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

function ArtistOrdersPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<ArtistOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const metric = new URLSearchParams(location.search).get('metric');

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const payload = await apiFetch('/api/artist/dashboard/orders');
        if (!active) return;
        const items = Array.isArray(payload?.items)
          ? payload.items
          : Array.isArray(payload)
          ? payload
          : [];
        setOrders(items);
      } catch (err: any) {
        if (!active) return;
        setOrders([]);
        setError(err?.message ?? 'Failed to load artist orders');
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const formatCurrency = (cents?: number) => {
    if (typeof cents !== 'number' || !Number.isFinite(cents)) return '-';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 2,
    }).format(cents / 100);
  };

  const formatDateTime = (value?: string) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString();
  };

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
  const totalHeaderClass = metric === 'gross' ? 'px-4 py-3 text-white' : 'px-4 py-3';

  return (
    <main>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Artist</p>
          <h1 className="text-2xl font-semibold text-white">Artist Orders</h1>
        </div>
        <Link className="text-sm text-slate-300 underline" to="/partner/artist">
          Back to dashboard
        </Link>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <label htmlFor="artist-orders-status" className="text-xs uppercase tracking-[0.3em] text-slate-400">
          Status
        </label>
        <select
          id="artist-orders-status"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
        >
          {statusOptions.map((status) => (
            <option key={status} value={status} className="bg-slate-900 text-white">
              {status === 'all' ? 'All' : status}
            </option>
          ))}
        </select>
        {metricHint && (
          <p className="text-xs uppercase tracking-[0.2em] text-white/60">{metricHint}</p>
        )}
      </div>

      <section className="mt-6">
        {loading && <p className="text-slate-400">Loading artist orders...</p>}
        {!loading && error && (
          <p role="alert" className="text-sm text-rose-300">
            Orders unavailable: {error}
          </p>
        )}
        {!loading && !error && filteredOrders.length === 0 && (
          <p className="text-sm text-slate-400">No orders found for this filter.</p>
        )}
        {!loading && !error && filteredOrders.length > 0 && (
          <div
            className="overflow-hidden rounded-2xl border border-white/10 bg-white/5"
            data-testid="artist-orders-table"
          >
            <table className="w-full text-left text-sm text-white">
              <thead>
                <tr className="border-b border-white/10 text-xs uppercase tracking-[0.3em] text-slate-400">
                  <th className="px-4 py-3">Order</th>
                  <th className="px-4 py-3">Status</th>
                  <th className={totalHeaderClass}>Total</th>
                  <th className="px-4 py-3">Created</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((order, index) => {
                  const orderId = order?.orderId ?? order?.id ?? `order-${index}`;
                  return (
                    <tr
                      key={orderId}
                      data-testid="artist-orders-row"
                      className="cursor-pointer border-b border-white/5 transition hover:bg-white/10"
                      onClick={() => navigate(`/partner/artist/orders/${orderId}`)}
                    >
                      <td className="px-4 py-3 font-mono">{order?.orderId ?? order?.id ?? '-'}</td>
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
    </main>
  );
}

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

function ArtistOrderDetailPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const [detail, setDetail] = useState<ArtistOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
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
    })();
    return () => {
      active = false;
    };
  }, [orderId]);

  const formatCurrency = (cents?: number) => {
    if (typeof cents !== 'number' || !Number.isFinite(cents)) return '-';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 2,
    }).format(cents / 100);
  };

  const formatDateTime = (value?: string | null) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString();
  };

  return (
    <main>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Artist</p>
          <h1 className="text-2xl font-semibold text-white">Artist Order Detail</h1>
        </div>
        <Link className="text-sm text-slate-300 underline" to="/partner/artist/orders">
          Back to artist orders
        </Link>
      </div>

      {loading && <p className="mt-6 text-slate-400">Loading order detail...</p>}
      {!loading && error && (
        <p role="alert" className="mt-6 text-sm text-rose-300">
          {error}
        </p>
      )}

      {!loading && !error && detail && (
        <section className="mt-6 space-y-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Order ID</p>
            <p className="mt-2 font-mono text-sm text-white">{detail.id ?? '-'}</p>
            <div className="mt-3 grid gap-3 text-sm text-white/80 md:grid-cols-3">
              <p>Status: {detail.status ?? '-'}</p>
              <p>Created: {formatDateTime(detail.createdAt)}</p>
              <p>Total: {formatCurrency(detail.totalCents)}</p>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
            <div className="grid grid-cols-[1.6fr_1.2fr_0.8fr_1fr_1fr] gap-3 border-b border-white/10 px-4 py-3 text-xs uppercase tracking-[0.3em] text-slate-400">
              <span>Product</span>
              <span>Variant</span>
              <span>Qty</span>
              <span>Price</span>
              <span>Line total</span>
            </div>
            <div className="divide-y divide-white/10">
              {(detail.items ?? []).map((item, index) => {
                const variantParts = [item.variantSku, item.variantSize, item.variantColor]
                  .filter(Boolean)
                  .join(' / ');
                return (
                  <div
                    key={`${item.productId ?? 'item'}-${index}`}
                    className="grid grid-cols-[1.6fr_1.2fr_0.8fr_1fr_1fr] gap-3 px-4 py-3 text-sm text-white"
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
                <p className="px-4 py-4 text-sm text-slate-400">No line items available.</p>
              )}
            </div>
          </div>
        </section>
      )}
    </main>
  );
}

function useAsyncResult<T>(fn: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fn();
      setData(result);
    } catch (err: any) {
      setError(safeErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [fn]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, error, reload: load };
}

function MePage() {
  const { data, loading, error, reload } = useAsyncResult(getMe);
  return (
    <main>
      <h1>Me</h1>
      {loading && <p>Loading...</p>}
      {error && (
        <p role="alert">
          {error}{' '}
          <button type="button" onClick={reload}>
            Retry
          </button>
        </p>
      )}
      {!loading && !error && <pre>{JSON.stringify(data, null, 2)}</pre>}
    </main>
  );
}

function ConfigPage() {
  const { data, loading, error, reload } = useAsyncResult(getConfig);
  return (
    <main>
      <h1>Config</h1>
      {loading && <p>Loading...</p>}
      {error && (
        <p role="alert">
          {error}{' '}
          <button type="button" onClick={reload}>
            Retry
          </button>
        </p>
      )}
      {!loading && !error && <pre>{JSON.stringify(data, null, 2)}</pre>}
    </main>
  );
}

function useAuthStatus() {
  const location = useLocation();
  const [role, setRole] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [hasToken, setHasToken] = useState(() => Boolean(getAccessToken()));

  useEffect(() => {
    let isMounted = true;
    const currentToken = getAccessToken();
    setHasToken(Boolean(currentToken));

    if (!currentToken) {
      setRole(null);
      setAuthChecked(true);
      return;
    }

    setAuthChecked(false);

    (async () => {
      try {
        const me = await apiFetch('/auth/whoami');
        if (!isMounted) return;
        const resolvedRole =
          me?.role ||
          (Array.isArray(me?.roles) ? me.roles[0] : null) ||
          me?.user?.role ||
          null;
        setRole(resolvedRole);
      } catch (err: any) {
        const message = typeof err?.message === 'string' ? err.message : '';
        if (message.includes('401') || message.includes('403')) {
          clearTokens();
          setHasToken(false);
          setRole(null);
        }
      } finally {
        if (isMounted) {
          setAuthChecked(true);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [location.pathname]);

  return { role, authChecked, hasToken };
}

function Loading() {
  return (
    <main>
      <p>Loading...</p>
    </main>
  );
}

function LegacyRedirect({ to }: { to: string }) {
  const location = useLocation();
  return <Navigate replace to={{ pathname: to, search: location.search }} />;
}

function ParamsRedirect({
  to,
}: {
  to: (params: Record<string, string | undefined>) => string;
}) {
  const params = useParams<Record<string, string | undefined>>();
  const location = useLocation();
  return (
    <Navigate
      replace
      to={{
        pathname: to(params),
        search: location.search,
      }}
    />
  );
}

function AppRoutes() {
  const { role, authChecked, hasToken } = useAuthStatus();
  const location = useLocation();
  const effectiveRole = hasToken ? role : null;

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  if (hasToken && !authChecked) {
    return <Loading />;
  }

  const withPartnerLogout = (element: React.ReactNode) => {
    if (!location.pathname.startsWith('/partner/')) {
      return element;
    }

    return (
      <div className="space-y-4">
        <div className="mx-auto flex w-full max-w-6xl justify-end px-6 pt-4">
          <button
            type="button"
            onClick={() => {
              clearTokens();
              sessionStorage.clear();
              localStorage.removeItem(LOGIN_CONTEXT_KEY);
              window.location.assign('/partner/login');
            }}
            className="rounded-full border border-white/20 px-3 py-1 text-xs uppercase tracking-[0.3em] text-slate-300 hover:bg-white/10 hover:text-white"
          >
            Logout
          </button>
        </div>
        {element}
      </div>
    );
  };

  const requireAuthElement = (element: React.ReactNode) => {
    if (isAuthBypassPath(location.pathname)) {
      return element;
    }

    if (!hasToken && !authChecked) {
      return <Loading />;
    }

    if (!hasToken) {
      const returnUrl = encodeURIComponent(location.pathname + location.search);
      return <Navigate to={`/login?returnUrl=${returnUrl}`} replace />;
    }

    if (!authChecked) {
      return <Loading />;
    }

      if (effectiveRole && !roleAllowsPath(effectiveRole, location.pathname)) {
        console.log('[guard] redirecting', {
          role: effectiveRole,
          path: location.pathname,
          reason: 'forbidden',
        });
        return <Navigate to="/forbidden" replace />;
      }

    return withPartnerLogout(element);
  };

  const loginEntryElement = (element: React.ReactNode) => {
    if (hasToken && !authChecked) {
      return <Loading />;
    }
    if (hasToken && authChecked) {
      const loginContext = localStorage.getItem(LOGIN_CONTEXT_KEY);
      const requested = getRequestedLoginPath(location.search);
      const target = getPostLoginRedirect({
        loginContext,
        next: requested,
        role: effectiveRole,
      });
      localStorage.removeItem(LOGIN_CONTEXT_KEY);
      return <Navigate to={target} replace />;
    }
    return element;
  };

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route
          index
          element={
            <PublicLayout>
              <LandingPage />
            </PublicLayout>
          }
        />
        <Route
          path="products"
          element={
            <PublicLayout>
              <ProductsPage />
            </PublicLayout>
          }
        />
        <Route
          path="products/:id"
          element={
            <PublicLayout>
              <ProductDetail />
            </PublicLayout>
          }
        />
        <Route
          path="artists"
          element={
            <PublicLayout>
              <ArtistsPage />
            </PublicLayout>
          }
        />
        <Route
          path="artists/:handle"
          element={
            <PublicLayout>
              <ArtistPage />
            </PublicLayout>
          }
        />
        <Route
          path="artists/dashboard"
          element={<RedirectPage to="/partner/artist" />}
        />
        <Route
          path="artists/products"
          element={<RedirectPage to="/partner/artist/products" />}
        />
        <Route
          path="artists/drop/:id"
          element={<RedirectPage to="/partner/artist/drop/:id" />}
        />
        <Route
          path="drops"
          element={
            <PublicLayout>
              <DropsPage />
            </PublicLayout>
          }
        />
        <Route
          path="drops/:handle"
          element={
            <PublicLayout>
              <DropPage />
            </PublicLayout>
          }
        />
        <Route
          path="apply/artist"
          element={
            <PublicLayout>
              <ApplyArtistPage />
            </PublicLayout>
          }
        />
        <Route path="cart" element={<CartPage />} />
        <Route path="forbidden" element={<ForbiddenPage />} />
        <Route path="notfound" element={<NotFoundPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
      <Route
        path="/login"
        element={loginEntryElement(<LegacyRedirect to="/fan/login" />)}
      />
      <Route
        path="/fan/login"
        element={loginEntryElement(<FanLoginPage />)}
      />
      <Route path="/fan/register" element={<FanRegisterPage />} />
      <Route
        path="/partner/login"
        element={loginEntryElement(<PartnerLoginPage />)}
      />
      <Route path="/logout" element={<LogoutPage />} />
      <Route path="/status" element={<StatusPage />} />
      <Route path="/me" element={<MePage />} />
      <Route path="/config" element={<ConfigPage />} />
      <Route path="/smoke" element={requireAuthElement(<Smoke />)} />
      <Route path="/fan" element={requireAuthElement(<BuyerLayout />)}>
        <Route index element={<BuyerDashboardPage />} />
        <Route path="orders" element={<BuyerOrdersPage />} />
        <Route path="orders/:id" element={<BuyerOrderDetailPage />} />
        <Route path="addresses" element={<BuyerAddressesPage />} />
        <Route path="payment-methods" element={<BuyerPaymentMethodsPage />} />
      </Route>
      <Route
        path="/partner/artist"
        element={requireAuthElement(<Outlet />)}
      >
        <Route index element={<ArtistDashboard />} />
        <Route
          path="dashboard"
          element={<Navigate to="/partner/artist" replace />}
        />
        <Route
          path="orders"
          element={<ArtistOrdersPage />}
        />
        <Route
          path="orders/:orderId"
          element={<ArtistOrderDetailPage />}
        />
        <Route
          path="drop/:id"
          element={<Navigate to="/partner/artist/drops" replace />}
        />
        <Route
          path="products"
          element={<ArtistProductsPage />}
        />
        <Route
          path="products/:id/variants"
          element={<ArtistProductVariantsPage />}
        />
        <Route
          path="drops"
          element={<ArtistDropsPage />}
        />
      </Route>
      <Route
        path="/partner/label"
        element={requireAuthElement(<LabelDashboard />)}
      />
      <Route
        path="/partner/label/orders"
        element={requireAuthElement(<LabelDashboard />)}
      />
      <Route
        path="/partner/label/orders/:id"
        element={requireAuthElement(<LabelDashboard />)}
      />
      <Route
        path="/partner/label/artists"
        element={requireAuthElement(<LabelDashboard />)}
      />
      <Route
        path="/partner/label/artists/:artistId"
        element={requireAuthElement(<LabelArtistDetailPage />)}
      />
      <Route
        path="/partner/label/artist/:artistId"
        element={requireAuthElement(<ParamsRedirect to={(params) => `/partner/label/artists/${params.artistId ?? ''}`} />)}
      />
      <Route
        path="/partner/admin"
        element={requireAuthElement(<AdminDashboard />)}
      />
      <Route
        path="/partner/admin/orders"
        element={requireAuthElement(<AdminOrders />)}
      />
      <Route
        path="/partner/admin/artist-requests"
        element={requireAuthElement(<AdminArtistRequests />)}
      />
      <Route
        path="/partner/admin/leads"
        element={requireAuthElement(<AdminLeadsPage />)}
      />
      <Route
        path="/partner/admin/artists"
        element={requireAuthElement(<AdminArtistsPage />)}
      />
      <Route
        path="/partner/admin/artists/:id"
        element={requireAuthElement(<AdminArtistDetailPage />)}
      />
      <Route
        path="/partner/admin/products"
        element={requireAuthElement(<AdminProductsPage />)}
      />
      <Route
        path="/partner/admin/products/new"
        element={requireAuthElement(<AdminCreateProductPage />)}
      />
      <Route
        path="/partner/admin/drops"
        element={requireAuthElement(<AdminDropsPage />)}
      />
      <Route
        path="/partner/admin/products/:id/variants"
        element={requireAuthElement(<AdminProductVariants />)}
      />
      <Route
        path="/partner/admin/orders/:id"
        element={requireAuthElement(<AdminOrderDetail />)}
      />
      <Route
        path="/partner/admin/order/:id"
        element={requireAuthElement(<AdminOrderDetail />)}
      />
      <Route path="/buyer" element={<LegacyRedirect to="/fan" />} />
      <Route path="/buyer/orders" element={<LegacyRedirect to="/fan/orders" />} />
      <Route
        path="/buyer/orders/:id"
        element={
          <ParamsRedirect to={(params) => `/fan/orders/${params.id ?? ''}`} />
        }
      />
      <Route
        path="/buyer/order/:id"
        element={
          <ParamsRedirect to={(params) => `/fan/orders/${params.id ?? ''}`} />
        }
      />
      <Route
        path="/artist/*"
        element={<Navigate to="/partner/artist" replace />}
      />
      <Route
        path="/artists/dashboard"
        element={<LegacyRedirect to="/partner/artist" />}
      />
      <Route
        path="/artists/products"
        element={<LegacyRedirect to="/partner/artist/products" />}
      />
      <Route
        path="/label"
        element={<LegacyRedirect to="/partner/label" />}
      />
      <Route
        path="/label/orders"
        element={<LegacyRedirect to="/partner/label/orders" />}
      />
      <Route
        path="/label/orders/:id"
        element={
          <ParamsRedirect
            to={(params) => `/partner/label/orders/${params.id ?? ''}`}
          />
        }
      />
      <Route
        path="/label/artists"
        element={<LegacyRedirect to="/partner/label/artists" />}
      />
      <Route
        path="/label/artist/:artistId"
        element={
          <ParamsRedirect
            to={(params) => `/partner/label/artists/${params.artistId ?? ''}`}
          />
        }
      />
      <Route
        path="/admin"
        element={<LegacyRedirect to="/partner/admin" />}
      />
      <Route
        path="/admin/orders"
        element={<LegacyRedirect to="/partner/admin/orders" />}
      />
      <Route
        path="/admin/artist-requests"
        element={
          <LegacyRedirect to="/partner/admin/artist-requests" />
        }
      />
      <Route
        path="/admin/leads"
        element={<LegacyRedirect to="/partner/admin/leads" />}
      />
      <Route
        path="/admin/artists"
        element={<LegacyRedirect to="/partner/admin/artists" />}
      />
      <Route
        path="/admin/artists/:id"
        element={
          <ParamsRedirect
            to={(params) => `/partner/admin/artists/${params.id ?? ''}`}
          />
        }
      />
      <Route
        path="/admin/products"
        element={<LegacyRedirect to="/partner/admin/products" />}
      />
      <Route
        path="/admin/products/:id/variants"
        element={
          <ParamsRedirect
            to={(params) => `/partner/admin/products/${params.id ?? ''}/variants`}
          />
        }
      />
      <Route
        path="/admin/orders/:id"
        element={
          <ParamsRedirect
            to={(params) => `/partner/admin/orders/${params.id ?? ''}`}
          />
        }
      />
      <Route
        path="/admin/order/:id"
        element={
          <ParamsRedirect
            to={(params) => `/partner/admin/order/${params.id ?? ''}`}
          />
        }
      />
      <Route
        path="/admin/provisioning"
        element={requireAuthElement(<AdminProvisioningPage />)}
      />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default function App() {
  return (
    <CartProvider>
      <ToastProvider>
        <AppRoutes />
      </ToastProvider>
    </CartProvider>
  );
}

function AppLayout() {
  return <Outlet />;
}
