import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  getAdminOrder,
  fulfillAdminOrder,
  refundAdminOrder,
} from '../../shared/api/adminOrdersApi';
import { safeErrorMessage } from '../../shared/utils/safeError';
import { formatCurrencyFromCents } from '../../shared/utils/currency';

type OrderItem = {
  id?: string;
  productId?: string;
  productVariantId?: string;
  quantity?: number;
  priceCents?: number;
};

type OrderDetail = {
  id?: string;
  status?: string;
  totalCents?: number;
  createdAt?: string;
  buyerUserId?: string;
  payment?: {
    paymentId?: string;
    status?: string;
    provider?: string;
  } | null;
  items?: OrderItem[];
};

const statusPillClass = (status: string) => {
  const normalized = status.toLowerCase();
  if (normalized === 'fulfilled') return 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/20';
  if (normalized === 'placed' || normalized === 'paid') return 'bg-sky-500/10 text-sky-300 ring-sky-500/20';
  if (normalized === 'cancelled') return 'bg-rose-500/10 text-rose-300 ring-rose-500/20';
  if (normalized === 'refunded') return 'bg-amber-500/10 text-amber-300 ring-amber-500/20';
  return 'bg-slate-500/10 text-slate-300 ring-slate-500/20';
};

const formatLocalDateTime = (value?: string | null) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
};

export default function AdminOrderDetail() {
  const { id, orderId } = useParams<{ id?: string; orderId?: string }>();
  const resolvedOrderId = id ?? orderId ?? '';
  const [data, setData] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fulfillBusy, setFulfillBusy] = useState(false);
  const [refundBusy, setRefundBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const load = async () => {
    if (!resolvedOrderId) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const payload = await getAdminOrder(resolvedOrderId);
      setData(payload);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load order');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [resolvedOrderId]);

  const orderStatus = String(data?.status ?? '').toLowerCase();
  const paymentStatus = String(data?.payment?.status ?? '').toLowerCase();
  const paymentProvider = data?.payment?.provider ?? '-';
  const items = Array.isArray(data?.items) ? data?.items : [];
  const canFulfill = ['placed', 'paid'].includes(orderStatus) && !fulfillBusy && !refundBusy;
  const canRefund = ['paid', 'captured'].includes(paymentStatus) && !fulfillBusy && !refundBusy;

  return (
    <main className="space-y-6">
      <div className="space-y-1">
        <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Admin</p>
        <h1 className="text-3xl font-semibold text-white">Order Detail</h1>
      </div>

      {loading && <p>Loading...</p>}
      {error && (
        <p role="alert">
          {error}{' '}
          <button type="button" onClick={load}>
            Retry
          </button>
        </p>
      )}

      {actionMessage && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {actionMessage}
        </div>
      )}
      {actionError && (
        <div role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {actionError}
        </div>
      )}

      {!loading && !error && data && (
        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="text-sm uppercase tracking-[0.35em] text-slate-400">Order Summary</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Order ID</p>
              <p className="mt-1 text-sm text-white break-all">{data.id ?? '-'}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Status</p>
              <span
                className={`mt-1 inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase ring-1 ${statusPillClass(
                  orderStatus || 'unknown'
                )}`}
              >
                {orderStatus || 'unknown'}
              </span>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Created</p>
              <p className="mt-1 text-sm text-white">{formatLocalDateTime(data.createdAt)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Total</p>
              <p className="mt-1 text-sm text-white">{formatCurrencyFromCents(data.totalCents ?? null)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Buyer</p>
              <p className="mt-1 text-sm text-white break-all">{data.buyerUserId ?? '-'}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Payment</p>
              <p className="mt-1 text-sm text-white">
                Status: {paymentStatus || '-'} | Provider: {paymentProvider}
              </p>
            </div>
          </div>
        </section>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={async () => {
            if (!resolvedOrderId) return;
            setActionError(null);
            setActionMessage(null);
            setFulfillBusy(true);
            try {
              await fulfillAdminOrder(resolvedOrderId);
              await load();
              setActionMessage('Order fulfilled');
            } catch (err: any) {
              setActionError(safeErrorMessage(err));
            } finally {
              setFulfillBusy(false);
            }
          }}
          disabled={!canFulfill}
          className="rounded-xl border border-white/20 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
        >
          {fulfillBusy ? 'Fulfilling...' : 'Fulfill Order'}
        </button>
        <button
          type="button"
          onClick={async () => {
            if (!resolvedOrderId) return;
            setActionError(null);
            setActionMessage(null);
            setRefundBusy(true);
            try {
              await refundAdminOrder(resolvedOrderId);
              await load();
              setActionMessage('Order refunded');
            } catch (err: any) {
              setActionError(safeErrorMessage(err));
            } finally {
              setRefundBusy(false);
            }
          }}
          disabled={!canRefund}
          className="rounded-xl border border-white/20 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
        >
          {refundBusy ? 'Refunding...' : 'Refund Order'}
        </button>
      </div>

      {!loading && !error && data && (
        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="text-sm uppercase tracking-[0.35em] text-slate-400">Items</h2>
          {items.length === 0 ? (
            <p className="mt-3 text-sm text-slate-300">No items found.</p>
          ) : (
            <div className="mt-4 overflow-hidden rounded-xl border border-white/10">
              <table className="w-full text-left text-sm text-white">
                <thead className="bg-white/5 text-xs uppercase tracking-[0.25em] text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Product</th>
                    <th className="px-4 py-3">Variant</th>
                    <th className="px-4 py-3">Qty</th>
                    <th className="px-4 py-3">Price</th>
                    <th className="px-4 py-3">Line Total</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => {
                    const qty = Number(item.quantity ?? 0);
                    const priceCents = Number(item.priceCents ?? 0);
                    const lineTotalCents = qty * priceCents;
                    return (
                      <tr key={item.id ?? `${item.productId}-${index}`} className="border-t border-white/10">
                        <td className="px-4 py-3 break-all">{item.productId ?? '-'}</td>
                        <td className="px-4 py-3 break-all">{item.productVariantId ?? '-'}</td>
                        <td className="px-4 py-3">{qty}</td>
                        <td className="px-4 py-3">{formatCurrencyFromCents(priceCents)}</td>
                        <td className="px-4 py-3">{formatCurrencyFromCents(lineTotalCents)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {!loading && !error && data && (
        <details className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <summary className="cursor-pointer select-none text-sm text-white/70">
            Raw payload (debug)
          </summary>
          <pre className="mt-3 overflow-auto rounded-xl bg-black/30 p-4 text-xs text-white/80">
            {JSON.stringify(data, null, 2)}
          </pre>
        </details>
      )}
    </main>
  );
}
