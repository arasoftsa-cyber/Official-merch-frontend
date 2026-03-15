import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../../../shared/api/http";
import { Card } from "../../../shared/ui/Page";
import {
  formatCurrencyFromCents,
  formatDate,
} from "../../../shared/utils/formatting";

type OrderLike = {
  id: string;
  status?: string | null;
  paymentStatus?: string | null;
  createdAt?: string | null;
  totalCents?: number | null;
  total?: number | null;
};

type FilterKey = "all" | "unpaid" | "paid" | "fulfilled" | "cancelled" | "refunded";

const FILTER_OPTIONS: Array<{ label: string; value: FilterKey }> = [
  { label: "All", value: "all" },
  { label: "Unpaid", value: "unpaid" },
  { label: "Paid", value: "paid" },
  { label: "Fulfilled", value: "fulfilled" },
  { label: "Cancelled", value: "cancelled" },
  { label: "Refunded", value: "refunded" },
];

function normalizeStatus(status?: string | null) {
  return (status ?? "").toString().trim().toUpperCase();
}

function isUnpaidStatus(status: string) {
  return /UNPAID|PLACED|PENDING|PENDING_PAYMENT/.test(status);
}

function formatMoney(order: OrderLike) {
  const cents =
    (typeof order.totalCents === "number" && order.totalCents) ||
    (typeof order.total === "number" ? order.total * 100 : null);
  if (cents != null) {
    return formatCurrencyFromCents(cents);
  }
  return "-";
}

function normalizeOrderList(raw: any): OrderLike[] {
  if (Array.isArray(raw)) return raw;
  const candidate =
    raw?.items ??
    raw?.orders ??
    raw?.data ??
    raw?.rows ??
    raw?.results ??
    raw?.products ??
    raw?.payload ??
    raw;
  if (Array.isArray(candidate)) return candidate;
  return [];
}

async function fetchOrdersFallback(): Promise<OrderLike[]> {
  try {
    const data = await apiFetch("/orders/my");
    return normalizeOrderList(data);
  } catch (err: any) {
    if (Number(err?.status || 0) === 401) {
      throw new Error("Session expired. Please login again.");
    }
    throw err;
  }
}

export default function BuyerOrdersPage() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<OrderLike[]>([]);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadOrders = async (mounted = true) => {
    setLoading(true);
    setError(null);
    try {
      const finalList = (await fetchOrdersFallback()) as OrderLike[];
      if (mounted) setOrders(finalList);
    } catch (err: any) {
      if (mounted) setError(err?.message ?? "Failed to load orders");
    } finally {
      if (mounted) setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    void loadOrders(mounted);
    return () => {
      mounted = false;
    };
  }, []);

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const status = normalizeStatus(order.status || order.paymentStatus);
      if (filter === "all") return true;
      if (filter === "unpaid") return isUnpaidStatus(status);
      if (filter === "paid") return status.includes("PAID");
      if (filter === "fulfilled") return status.includes("FULFILLED");
      if (filter === "cancelled") return status.includes("CANCELLED");
      if (filter === "refunded") return status.includes("REFUNDED");
      return true;
    });
  }, [orders, filter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">My Orders</h1>
        <div className="flex flex-wrap gap-2">
          {FILTER_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setFilter(option.value)}
              className={`rounded-full border px-4 py-1.5 text-xs font-semibold uppercase tracking-wider transition ${filter === option.value
                  ? "border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-black"
                  : "border-slate-200 text-slate-600 hover:border-slate-400 dark:border-white/20 dark:text-slate-300 dark:hover:border-white/40"
                }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="flex animate-pulse items-center space-x-2 text-slate-500 dark:text-slate-400">
          <div className="h-4 w-4 rounded-full bg-slate-200 dark:bg-white/10" />
          <span className="text-sm">Loading orders...</span>
        </div>
      )}

      {!loading && error && (
        <Card className="flex flex-col items-center justify-center p-8 text-center border-rose-200 bg-rose-50 dark:border-rose-500/20 dark:bg-rose-500/5">
          <p className="text-sm font-medium text-rose-600 dark:text-rose-400">{error}</p>
          <button
            type="button"
            onClick={() => {
              setError(null);
              setOrders([]);
              void loadOrders(true);
            }}
            className="mt-4 rounded-full border border-rose-300 px-6 py-2 text-xs font-bold uppercase tracking-widest text-rose-700 transition hover:bg-rose-100 dark:border-rose-500/40 dark:text-rose-300 dark:hover:bg-rose-500/10"
          >
            Retry
          </button>
        </Card>
      )}

      {!loading && !error && filteredOrders.length === 0 && (
        <Card className="flex flex-col items-center justify-center p-12 text-center">
          <p className="text-slate-500 dark:text-slate-400">No orders found for this filter.</p>
          <button
            type="button"
            onClick={() => navigate("/products")}
            className="mt-6 rounded-full bg-slate-900 px-6 py-2.5 text-xs font-bold uppercase tracking-widest text-white transition hover:bg-slate-800 dark:bg-white dark:text-black dark:hover:bg-slate-200"
          >
            Browse products
          </button>
        </Card>
      )}

      {!loading && !error && filteredOrders.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-white/10">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-400">
                  <th className="px-6 py-4">Order</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Total</th>
                  <th className="px-6 py-4">Created</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white dark:divide-white/5 dark:bg-transparent">
                {filteredOrders.map((order) => {
                  const status = normalizeStatus(order.status || order.paymentStatus);
                  const shortId = (order.id || "").slice(0, 8) || "-";
                  const created = order.createdAt
                    ? formatDate(order.createdAt, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })
                    : "-";

                  return (
                    <tr
                      key={order.id}
                      className="group transition-colors hover:bg-slate-50 dark:hover:bg-white/5"
                    >
                      <td className="whitespace-nowrap px-6 py-4 font-mono text-xs text-slate-600 dark:text-slate-400">
                        {shortId}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:bg-white/10 dark:text-slate-300">
                          {status || "-"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-slate-900 dark:text-white">
                        {formatMoney(order)}
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-500 dark:text-slate-400">
                        {created}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => navigate(`/fan/orders/${order.id}`)}
                            className="rounded-full border border-slate-200 px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-700 transition hover:border-slate-900 hover:bg-slate-900 hover:text-white dark:border-white/20 dark:text-slate-300 dark:hover:border-white dark:hover:bg-white dark:hover:text-black"
                          >
                            View
                          </button>
                          {isUnpaidStatus(status) && (
                            <button
                              type="button"
                              onClick={() => navigate(`/fan/orders/${order.id}`)}
                              className="rounded-full bg-indigo-600 px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white transition hover:bg-indigo-500"
                            >
                              Pay
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
