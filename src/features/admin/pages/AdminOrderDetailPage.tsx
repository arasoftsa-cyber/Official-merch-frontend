import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  getAdminOrder,
  fulfillAdminOrder,
  refundAdminOrder,
} from '../../../shared/api/adminOrdersApi';
import { safeErrorMessage } from '../../../shared/utils/safeError';
import { formatCurrencyFromCents } from '../../../shared/utils/currency';

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
  if (normalized === 'fulfilled') return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 ring-emerald-500/20';
  if (normalized === 'placed' || normalized === 'paid') return 'bg-sky-500/10 text-sky-600 dark:text-sky-300 ring-sky-500/20';
  if (normalized === 'cancelled') return 'bg-rose-500/10 text-rose-600 dark:text-rose-300 ring-rose-500/20';
  if (normalized === 'refunded') return 'bg-amber-500/10 text-amber-600 dark:text-amber-300 ring-amber-500/20';
  return 'bg-slate-500/10 text-slate-600 dark:text-slate-300 ring-slate-500/20';
};

const formatLocalDateTime = (value?: string | null) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
};

export default function AdminOrderDetailPage() {
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
    <main className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 dark:text-slate-500">Admin Dispatch</p>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white">Order Detail</h1>
        </div>
        <Link
          to="/partner/admin/orders"
          className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-white transition-all border border-slate-200 dark:border-white/10 px-4 py-1.5 rounded-full"
        >
          Back to list
        </Link>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <p className="text-xs font-black uppercase tracking-widest text-slate-400 animate-pulse">Loading Order Data...</p>
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-rose-200 dark:border-rose-400/40 bg-rose-50 dark:bg-rose-500/10 p-6 text-center">
          <p className="text-sm font-bold text-rose-600 dark:text-rose-400">{error}</p>
          <button
            type="button"
            onClick={load}
            className="mt-4 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-rose-600 transition-colors"
          >
            Retry Connection
          </button>
        </div>
      )}

      {actionMessage && (
        <div className="rounded-xl border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 px-4 py-3 text-sm font-bold text-emerald-700 dark:text-emerald-300 shadow-sm animate-in fade-in slide-in-from-top-2">
          {actionMessage}
        </div>
      )}
      {actionError && (
        <div role="alert" className="rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 px-4 py-3 text-sm font-bold text-rose-700 dark:text-rose-300 shadow-sm animate-in fade-in slide-in-from-top-2">
          {actionError}
        </div>
      )}

      {!loading && !error && data && (
        <div className="grid gap-6">
          <section className="rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.03] p-8 shadow-sm">
            <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 dark:text-slate-500 mb-8">Order Information</h2>
            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400">Reference ID</p>
                <p className="mt-2 text-sm font-bold text-slate-900 dark:text-white break-all">#{data.id?.slice(0, 13).toUpperCase() ?? '-'}</p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400">Order Status</p>
                <div className="mt-2">
                  <span
                    data-testid="admin-order-status"
                    className={`inline-flex rounded-full px-4 py-1 text-[10px] font-black uppercase tracking-widest ${statusPillClass(
                      orderStatus || 'unknown'
                    )}`}
                  >
                    {orderStatus || 'unknown'}
                  </span>
                </div>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400">Timeline</p>
                <p className="mt-2 text-sm font-bold text-slate-900 dark:text-white">{formatLocalDateTime(data.createdAt)}</p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400">Financials</p>
                <p className="mt-2 text-lg font-black text-slate-900 dark:text-white">{formatCurrencyFromCents(data.totalCents ?? null)}</p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400">Customer</p>
                <p className="mt-2 text-sm font-bold text-slate-900 dark:text-white break-all">{data.buyerUserId ?? '-'}</p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400">Payment Gateway</p>
                <p className="mt-2 text-xs font-bold text-slate-900 dark:text-white uppercase tracking-tight">
                  {paymentStatus || '-'} - {paymentProvider}
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.03] p-8 shadow-sm">
            <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 dark:text-slate-500 mb-6">Line Items</h2>
            {items.length === 0 ? (
              <p className="text-sm font-bold text-slate-400 dark:text-slate-500">Inventory set is empty.</p>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-black/20">
                <table className="w-full text-left text-sm text-slate-700 dark:text-white">
                  <thead className="bg-slate-100 dark:bg-white/5 text-[10px] font-black uppercase tracking-[0.25em] text-slate-400 dark:text-slate-500">
                    <tr>
                      <th className="px-6 py-4">Product Unit</th>
                      <th className="px-6 py-4">Configuration</th>
                      <th className="px-6 py-4 text-center">Quantity</th>
                      <th className="px-6 py-4">Unit Price</th>
                      <th className="px-6 py-4 text-right">Line Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                    {items.map((item, index) => {
                      const qty = Number(item.quantity ?? 0);
                      const priceCents = Number(item.priceCents ?? 0);
                      const lineTotalCents = qty * priceCents;
                      return (
                        <tr key={item.id ?? `${item.productId}-${index}`} className="hover:bg-white dark:hover:bg-white/5 transition-colors">
                          <td className="px-6 py-4 font-bold text-xs break-all">{item.productId ?? '-'}</td>
                          <td className="px-6 py-4 text-xs font-medium text-slate-500 dark:text-slate-400 break-all">{item.productVariantId ?? '-'}</td>
                          <td className="px-6 py-4 text-center font-black">{qty}</td>
                          <td className="px-6 py-4 font-bold">{formatCurrencyFromCents(priceCents)}</td>
                          <td className="px-6 py-4 text-right font-black">{formatCurrencyFromCents(lineTotalCents)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <footer className="flex flex-wrap items-center gap-4 py-4">
            <button
              data-testid="admin-order-fulfill"
              type="button"
              onClick={async () => {
                if (!resolvedOrderId) return;
                setActionError(null);
                setActionMessage(null);
                setFulfillBusy(true);
                try {
                  await fulfillAdminOrder(resolvedOrderId);
                  await load();
                  setActionMessage('Order fulfillment requested successfully');
                } catch (err: any) {
                  setActionError(safeErrorMessage(err));
                } finally {
                  setFulfillBusy(false);
                }
              }}
              disabled={!canFulfill}
              className="rounded-full bg-slate-900 dark:bg-white px-8 py-3 text-xs font-black uppercase tracking-widest text-white dark:text-slate-950 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-40 shadow-xl"
            >
              {fulfillBusy ? 'Processing...' : 'Mark as Fulfilled'}
            </button>
            <button
              data-testid="admin-order-refund"
              type="button"
              onClick={async () => {
                if (!resolvedOrderId) return;
                setActionError(null);
                setActionMessage(null);
                setRefundBusy(true);
                try {
                  await refundAdminOrder(resolvedOrderId);
                  await load();
                  setActionMessage('Refund transaction initiated');
                } catch (err: any) {
                  setActionError(safeErrorMessage(err));
                } finally {
                  setRefundBusy(false);
                }
              }}
              disabled={!canRefund}
              className="rounded-full border border-rose-200 dark:border-rose-500/20 bg-white dark:bg-transparent px-8 py-3 text-xs font-black uppercase tracking-widest text-rose-600 dark:text-rose-400 transition-all hover:bg-rose-50 dark:hover:bg-rose-500/10 active:scale-95 disabled:opacity-40"
            >
              {refundBusy ? 'Processing...' : 'Issue Refund'}
            </button>

            <details className="w-full mt-4 group">
              <summary className="cursor-pointer select-none text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-600 hover:text-indigo-600 dark:hover:text-white transition-colors list-none text-right">
                View System Metadata
              </summary>
              <pre className="mt-4 overflow-auto rounded-3xl bg-slate-900 p-6 text-[10px] font-mono leading-relaxed text-indigo-300 border border-white/5 shadow-2xl">
                {JSON.stringify(data, null, 2)}
              </pre>
            </details>
          </footer>
        </div>
      )}
    </main>
  );
}
