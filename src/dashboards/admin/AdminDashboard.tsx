import React, { useEffect, useState } from 'react';
import { apiFetch } from '../../shared/api/http';
import ErrorBanner from '../../components/ux/ErrorBanner';
import LoadingSkeleton from '../../components/ux/LoadingSkeleton';
import { useToast } from '../../components/ux/ToastHost';
import AppShell from '../../components/layout/AppShell';
import KpiCard from '../../components/ui/KpiCard';
import DataTable, { TableColumn } from '../../components/ui/DataTable';
import { formatCurrencyFromCents } from '../../shared/utils/currency';
import { Link, useNavigate } from 'react-router-dom';

type DashboardSummary = {
  orders?: {
    placed?: number;
    cancelled?: number;
    fulfilled?: number;
    total?: number;
  };
  gmvCents?: number;
  buyers?: {
    total?: number;
  };
  last7Days?: Array<{
    day?: string;
    fulfilledCount?: number;
    gmvCents?: number;
  }>;
};

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { notify } = useToast();
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingArtistRequests, setPendingArtistRequests] = useState<number | null>(null);
  const [pendingLoading, setPendingLoading] = useState(true);
  const [pendingError, setPendingError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await apiFetch('/admin/metrics');
      setData(payload);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load metrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    let active = true;

    const fetchPending = async () => {
      setPendingLoading(true);
      setPendingError(null);
      try {
        const payload = await apiFetch("/admin/artist-access-requests/pending-count");
        if (active) {
          setPendingArtistRequests(
            payload && typeof payload.count === "number"
              ? payload.count
              : payload?.count
              ? Number(payload.count)
              : 0
          );
        }
      } catch (err: any) {
        if (active) {
          setPendingArtistRequests(null);
          setPendingError(err?.message ?? "Failed to load requests");
        }
      } finally {
        if (active) {
          setPendingLoading(false);
        }
      }
    };

    fetchPending();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (error) {
      notify(error, 'error');
    }
  }, [error, notify]);

  useEffect(() => {
    if (pendingError) {
      notify(pendingError, 'error');
    }
  }, [pendingError, notify]);

  const orders = data?.orders;
  const last7Days = data?.last7Days ?? [];

  const columns: TableColumn<typeof last7Days[0]>[] = [
    { key: 'day', header: 'Day' },
    {
      key: 'fulfilledCount',
      header: 'Fulfilled',
      render: (row) => row.fulfilledCount ?? 0,
    },
    {
      key: 'gmvCents',
      header: 'GMV',
      render: (row) => formatCurrencyFromCents(row.gmvCents),
    },
  ];

  const summaryNumber = (value?: number) =>
    error ? (
      <span title={error}>!</span>
    ) : loading ? (
      '�'
    ) : (
      value ?? 0
    );

  const ordersValue = summaryNumber(orders?.total);
  const placedValue = summaryNumber(orders?.placed);
  const cancelledValue = summaryNumber(orders?.cancelled);
  const fulfilledValue = summaryNumber(orders?.fulfilled);
  const gmvValue = error
    ? <span title={error}>!</span>
    : loading
    ? '�'
    : formatCurrencyFromCents(data?.gmvCents ?? 0);
  const buyersValue = error
    ? <span title={error}>!</span>
    : loading
    ? '�'
    : data?.buyers?.total ?? 0;
  const pendingValue = pendingError
    ? <span title={pendingError}>!</span>
    : pendingLoading
    ? '�'
    : pendingArtistRequests ?? 0;

  return (
    <AppShell title="Admin Dashboard" subtitle="Read-only metrics for orders, buyers, and GMV.">
      {error && <ErrorBanner message={error} onRetry={load} />}
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        <Link
          to="/admin/orders"
          className="text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 hover:border-white/20 hover:bg-white/10 cursor-pointer rounded-2xl transition"
        >
          <KpiCard
            label="ORDERS"
            value={ordersValue}
            hint="All time"
            valueClassName="text-3xl"
          />
        </Link>
        <button
          type="button"
          onClick={() => navigate('/admin/artist-requests')}
          className="text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 hover:border-white/20 hover:bg-white/10 rounded-2xl transition"
        >
          <KpiCard
            label="ARTIST REQUESTS"
            value={pendingValue}
            hint="Pending applications"
          />
        </button>
        <button
          type="button"
          onClick={() => navigate('/partner/admin/leads')}
          className="text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 hover:border-white/20 hover:bg-white/10 rounded-2xl transition"
        >
          <KpiCard
            label="LEADS"
            value="—"
            hint="Drop quiz leads"
          />
        </button>
        <Link
          to="/partner/admin/artists"
          className="text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 hover:border-white/20 hover:bg-white/10 cursor-pointer rounded-2xl transition"
        >
          <KpiCard label="ARTISTS" value="—" hint="Onboarded artists" />
        </Link>
        <Link
          to="/partner/admin/products"
          className="text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 hover:border-white/20 hover:bg-white/10 cursor-pointer rounded-2xl transition"
        >
          <KpiCard label="PRODUCTS" value="—" hint="Manage catalog & variants" />
        </Link>
        <Link
          to="/partner/admin/drops"
          className="text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 hover:border-white/20 hover:bg-white/10 cursor-pointer rounded-2xl transition"
        >
          <KpiCard label="DROPS" value="â€”" hint="Manage drop campaigns" />
        </Link>
        <Link
          to="/partner/admin/homepage-banners"
          className="text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 hover:border-white/20 hover:bg-white/10 cursor-pointer rounded-2xl transition"
        >
          <KpiCard label="HOMEPAGE" value="-" hint="Manage hero banners" />
        </Link>
        <Link
          to="/admin/provisioning"
          className="text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 hover:border-white/20 hover:bg-white/10 cursor-pointer rounded-2xl transition"
        >
          <KpiCard label="PROVISIONING" value="—" hint="Create artists/labels & links" />
        </Link>
        <div className="md:col-span-2 grid gap-4 sm:grid-cols-2">
          <KpiCard
            label="GMV"
            value={gmvValue}
            hint="All time"
            valueClassName="text-4xl"
          />
          <KpiCard label="BUYERS" value={buyersValue} hint="All time" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3 mt-4">
        <button
          type="button"
          onClick={() => navigate('/admin/orders?status=placed')}
          className="text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 hover:border-white/20 hover:bg-white/10 rounded-2xl transition"
        >
          <KpiCard label="PLACED" value={placedValue} hint="Last 30 days" />
        </button>
        <button
          type="button"
          onClick={() => navigate('/admin/orders?status=cancelled')}
          className="text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 hover:border-white/20 hover:bg-white/10 rounded-2xl transition"
        >
          <KpiCard label="CANCELLED" value={cancelledValue} hint="Last 30 days" />
        </button>
        <button
          type="button"
          onClick={() => navigate('/admin/orders?status=fulfilled')}
          className="text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 hover:border-white/20 hover:bg-white/10 rounded-2xl transition"
        >
          <KpiCard label="FULFILLED" value={fulfilledValue} hint="Last 30 days" />
        </button>
      </div>
      {loading ? (
        <LoadingSkeleton count={1} className="mt-6" />
      ) : (
        <DataTable columns={columns} rows={last7Days} emptyText="No activity recorded yet." />
      )}
    </AppShell>
  );
}

