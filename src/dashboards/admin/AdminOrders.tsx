import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import DataTable, { TableColumn } from '../../components/ui/DataTable';
import { getAccessToken } from '../../shared/auth/tokenStore';
import { apiGet } from '../../lib/api';
import { Container, Page } from '../../ui/Page';
import { formatCurrencyFromCents } from '../../shared/utils/currency';
import ErrorBanner from '../../components/ux/ErrorBanner';
import LoadingSkeleton from '../../components/ux/LoadingSkeleton';

type OrderRecord = {
  id?: string;
  orderId?: string;
  _id?: string;
  status?: string;
  state?: string;
  total?: number | string;
  totalAmount?: number | string;
  amount?: number | string;
  amountTotal?: number | string;
  buyerEmail?: string;
  email?: string;
  buyerId?: string;
  userId?: string;
  createdAt?: string;
  created?: string;
  created_at?: string;
};

const normalizeId = (order: OrderRecord) =>
  order.id ?? order.orderId ?? order._id ?? 'unknown';

const getStatusLabel = (status?: string) => {
  const normalized = status?.toLowerCase() ?? 'unknown';
  if (['paid', 'fulfilled', 'cancelled', 'refunded'].includes(normalized)) {
    return normalized;
  }
  return 'unknown';
};

const getStatusOptions = (orders: OrderRecord[]) => {
  const statuses = new Set(orders.map((order) => getStatusLabel(order.status)));
  return ['all', ...Array.from(statuses).filter((status) => status !== 'unknown')];
};

const extractBuyer = (order: OrderRecord) =>
  order.buyerEmail ?? order.email ?? order.buyerId ?? order.userId ?? 'buyer';

const selectCreated = (order: OrderRecord) =>
  order.createdAt ?? order.created ?? order.created_at ?? '—';

const columns: TableColumn<OrderRecord>[] = [
  {
    header: 'Order',
    key: 'order',
    render: (order) => normalizeId(order).slice(0, 8),
  },
  {
    header: 'Buyer',
    key: 'buyer',
    render: (order) => extractBuyer(order),
  },
  {
    header: 'Status',
    key: 'status',
    render: (order) => getStatusLabel(order.status),
  },
    {
      header: 'Total',
      key: 'total',
      render: (order) => formatCurrencyFromCents(order.totalCents),
    },
  {
    header: 'Created',
    key: 'created',
    render: (order) => selectCreated(order),
  },
  {
    header: 'Action',
    key: 'action',
    render: (order) => (
      <Link
        to={`/admin/orders/${normalizeId(order)}`}
        data-testid="admin-order-link"
        className="text-xs font-semibold uppercase tracking-[0.4em] text-indigo-300"
      >
        View
      </Link>
    ),
  },
];

const endpoint = '/api/admin/orders';

export default function AdminOrders() {
  const token = getAccessToken();
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const navigate = useNavigate();
  const location = useLocation();
  const allowedStatuses = ['all', 'paid', 'fulfilled', 'cancelled', 'placed'];
  const getInitialStatus = () => {
    const params = new URLSearchParams(location.search);
    const statusParam = params.get('status')?.toLowerCase();
    return allowedStatuses.includes(statusParam ?? '') ? statusParam! : 'all';
  };
  const [statusFilter, setStatusFilter] = useState(getInitialStatus);

  useEffect(() => {
    if (!token) return;
    let active = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const payload: any = await apiGet(endpoint);
        const normalized: OrderRecord[] = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.items)
          ? payload.items
          : Array.isArray(payload?.orders)
          ? payload.orders
          : Array.isArray(payload?.data)
          ? payload.data
          : Array.isArray(payload?.results)
          ? payload.results
          : [];
        if (active) {
          setOrders(normalized);
        }
      } catch (err: any) {
        if (active) {
          setError(err?.message ?? 'Unable to load orders');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [token]);

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const textMatch = normalizeId(order)
        .toLowerCase()
        .includes(query.toLowerCase()) ||
        extractBuyer(order).toLowerCase().includes(query.toLowerCase());
      if (!textMatch) return false;
      if (statusFilter === 'all') return true;
      return getStatusLabel(order.status) === statusFilter;
    });
  }, [orders, query, statusFilter]);

  useEffect(() => {
    setPage(1);
  }, [query, statusFilter]);

  const paginatedOrders = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredOrders.slice(start, start + pageSize);
  }, [filteredOrders, page, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / pageSize));

  if (!token) {
    return (
      <Page>
        <Container className="space-y-3">
          <p>Authentication required.</p>
        </Container>
      </Page>
    );
  }

  if (loading) {
    return (
      <Page>
        <Container className="space-y-3">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Admin</p>
            <h1 className="text-3xl font-semibold text-white">Orders</h1>
          </div>
          <LoadingSkeleton count={2} />
        </Container>
      </Page>
    );
  }

  return (
    <Page>
      <Container className="space-y-6">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Admin</p>
          <h1 className="text-3xl font-semibold text-white">Orders</h1>
          <p className="text-xs text-white/60">Read-only snapshot</p>
        </div>

        <div className="flex gap-3">
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by order or buyer"
            className="flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder:text-slate-500 focus:border-white/30 focus:outline-none"
          />
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-white/30 focus:outline-none"
          >
            {getStatusOptions(orders).map((status) => (
              <option key={status} value={status}>
                {status === 'all' ? 'All' : status}
              </option>
            ))}
          </select>
        </div>

        {error && <ErrorBanner message={error} onRetry={() => setError(null)} />}
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs uppercase tracking-[0.4em] text-slate-400">
            Showing {paginatedOrders.length} of {filteredOrders.length} orders
          </div>
          <div className="flex gap-2 text-xs">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              className="rounded-xl border border-white/10 px-3 py-1 uppercase tracking-[0.3em] text-slate-300 disabled:opacity-40"
            >
              Prev
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              className="rounded-xl border border-white/10 px-3 py-1 uppercase tracking-[0.3em] text-slate-300 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>

        <DataTable
          columns={columns}
          rows={paginatedOrders}
          emptyText="No data available for selected period"
          rowOnClick={(order) => navigate(`/admin/orders/${normalizeId(order)}`)}
        />
      </Container>
    </Page>
  );
}
