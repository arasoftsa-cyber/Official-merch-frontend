import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import AppShell from '../../components/layout/AppShell';
import KpiCard from '../../components/ui/KpiCard';
import EmptyState from '../../components/ui/EmptyState';
import { apiFetch } from '../../shared/api/http';

type ArtistOrderItem = {
  productId: string;
  productVariantId: string | null;
  productTitle: string;
  quantity: number;
  priceCents: number;
  lineTotalCents: number;
};

type ArtistOrder = {
  id: string;
  status: string;
  totalCents: number;
  createdAt: string | null;
  items: ArtistOrderItem[];
};

type ArtistSummary = {
  artistId: string;
  artistName: string;
  orders30d: number;
  gross30d: number;
  units30d: number;
  activeProductsCount: number;
  totalGross: number;
  recentOrders: ArtistOrder[];
};

const toNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeSummary = (payload: any): ArtistSummary => ({
  artistId: String(payload?.artistId ?? ''),
  artistName: String(payload?.artistName ?? payload?.artistId ?? 'Artist'),
  orders30d: toNumber(payload?.orders30d),
  gross30d: toNumber(payload?.gross30d),
  units30d: toNumber(payload?.units30d),
  activeProductsCount: toNumber(payload?.activeProductsCount),
  totalGross: toNumber(payload?.totalGross ?? payload?.grossCents),
  recentOrders: Array.isArray(payload?.recentOrders)
    ? payload.recentOrders.map((order: any) => ({
        id: String(order?.id ?? ''),
        status: String(order?.status ?? ''),
        totalCents: toNumber(order?.totalCents),
        createdAt: order?.createdAt ? String(order.createdAt) : null,
        items: Array.isArray(order?.items)
          ? order.items.map((item: any) => ({
              productId: String(item?.productId ?? ''),
              productVariantId:
                item?.productVariantId === null || item?.productVariantId === undefined
                  ? null
                  : String(item.productVariantId),
              productTitle: String(item?.productTitle ?? item?.productId ?? 'Product'),
              quantity: toNumber(item?.quantity),
              priceCents: toNumber(item?.priceCents),
              lineTotalCents: toNumber(item?.lineTotalCents),
            }))
          : [],
      }))
    : [],
});

const formatCurrency = (cents: number) => `$${(cents / 100).toFixed(2)}`;

const formatDateTime = (value: string | null) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

export default function LabelArtistDetailPage() {
  const { artistId } = useParams<{ artistId: string }>();
  const [summary, setSummary] = useState<ArtistSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!artistId) {
        setError('Missing artist id');
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const payload = await apiFetch(`/api/labels/artists/${artistId}/summary`);
        if (!active) return;
        setSummary(normalizeSummary(payload));
      } catch (err: any) {
        if (!active) return;
        setSummary(null);
        setError(err?.message ?? 'Failed to load artist summary');
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [artistId]);

  return (
    <AppShell
      title={summary?.artistName ? `${summary.artistName}` : 'Artist Detail'}
      subtitle="Label-scoped performance for this artist."
    >
      <div className="flex items-center justify-between">
        <Link to="/partner/label" className="text-sm text-white/80 underline hover:text-white">
          Back to label dashboard
        </Link>
        {summary?.artistId && (
          <Link
            to={`/partner/label/orders?artistId=${encodeURIComponent(summary.artistId)}`}
            className="text-xs uppercase tracking-[0.3em] text-white/60 hover:text-white"
          >
            View label orders
          </Link>
        )}
      </div>

      {loading && <p>Loading...</p>}
      {!loading && error && (
        <div role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          {error}
        </div>
      )}

      {!loading && !error && summary && (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <KpiCard label="Orders 30d" value={summary.orders30d} hint="Recent order count" />
            <KpiCard label="Units 30d" value={summary.units30d} hint="Recent units sold" />
            <KpiCard label="Gross 30d" value={formatCurrency(summary.gross30d)} hint="Recent revenue" />
            <KpiCard label="Active Products" value={summary.activeProductsCount} hint="Currently active catalog" />
          </div>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Recent Orders</h2>
            {summary.recentOrders.length === 0 ? (
              <EmptyState
                title="No recent orders"
                description="This artist has no orders in the recent window."
              />
            ) : (
              <div className="space-y-3">
                {summary.recentOrders.slice(0, 20).map((order) => (
                  <article
                    key={order.id}
                    className="rounded-2xl border border-white/10 bg-white/5 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                      <p className="font-mono text-white/90">{order.id}</p>
                      <p className="text-white/70">{order.status || '-'}</p>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-xs text-white/60">
                      <p>{formatDateTime(order.createdAt)}</p>
                      <p>{formatCurrency(order.totalCents)}</p>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </AppShell>
  );
}
