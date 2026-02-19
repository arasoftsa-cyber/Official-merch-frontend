import React from 'react';

export type BuyerOrder = {
  id: string;
  status: string;
  totalCents?: number;
  lineTotal?: number;
  createdAt?: string;
  itemsCount?: number;
  payment?: { status?: string; provider?: string };
};

const statusClasses: Record<string, string> = {
  placed: 'bg-white/15 text-white',
  fulfilled: 'bg-emerald-500/20 text-emerald-200',
  cancelled: 'bg-red-500/20 text-red-200',
};

const formatCurrency = (cents?: number) => {
  if (typeof cents !== 'number' || Number.isNaN(cents)) {
    return '—';
  }
  return `$${(cents / 100).toFixed(2)}`;
};

const formatDate = (iso?: string) => {
  if (!iso) return '—';
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleString();
};

const formatCurrencyFromCents = (cents?: number | null) => {
  if (typeof cents === 'number' && !Number.isNaN(cents)) {
    return `₹${(cents / 100).toFixed(2)}`;
  }
  return '—';
};

const formatCurrency = (order: BuyerOrder) => {
  if (typeof order.totalCents === 'number') {
    return formatCurrencyFromCents(order.totalCents);
  }
  if (typeof order.lineTotal === 'number') {
    return `₹${(order.lineTotal / 100).toFixed(2)}`;
  }
  return '—';
};

export default function BuyerOrdersList({
  orders,
  isLoading,
  error,
  onOpenOrder,
}: {
  orders: BuyerOrder[];
  isLoading: boolean;
  error: string | null;
  onOpenOrder?: (id: string) => void;
}) {
  if (isLoading) {
    return <p className="text-sm text-white/70">Loading recent orders…</p>;
  }

  if (error) {
    return (
      <p role="alert" className="text-sm text-red-200">
        {error}
      </p>
    );
  }

  if (!orders.length) {
    return <p className="text-sm text-white/60">No orders yet.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-[0.4em] text-white/50">
            {['Order', 'Status', 'Total', 'Items', 'Created', 'Action'].map((label) => (
              <th key={label} className="pb-3 pr-4">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {orders.map((order) => (
            <tr key={order.id} className="text-white/80">
              <td className="py-3 pr-4 font-semibold text-white">
                {order.id.slice(0, 8)}…{order.id.slice(-4)}
              </td>
              <td className="py-3 pr-4">
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 text-[11px] ${statusClasses[
                    order.status.toLowerCase()
                  ] ?? 'bg-white/10 text-white/70'}`}
                >
                  {order.status}
                </span>
              </td>
              <td className="py-3 pr-4">{formatCurrency(order)}</td>
              <td className="py-3 pr-4">{order.itemsCount ?? '—'}</td>
              <td className="py-3 pr-4">{formatDate(order.createdAt)}</td>
              <td className="py-3">
                <button
                  type="button"
                  className="rounded-lg border border-white/15 px-3 py-1 text-xs font-semibold text-white transition hover:border-white/40"
                  onClick={() => onOpenOrder?.(order.id)}
                >
                  View
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
