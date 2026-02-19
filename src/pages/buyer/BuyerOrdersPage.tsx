import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getAccessToken } from "../../shared/auth/tokenStore";

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
    return `$${(cents / 100).toFixed(2)}`;
  }
  return "—";
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
  const token = getAccessToken();
  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch("/api/orders", {
    headers,
  });
  let message = `Failed to load orders (${res.status})`;
  if (res.status === 401) {
    message = "Session expired. Please login again.";
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text ? `${message}: ${text}` : message);
  }
  const data = await res.json().catch(() => null);
  return normalizeOrderList(data);
}

export default function BuyerOrdersPage() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<OrderLike[]>([]);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const fetchOrders = async () => {
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
    fetchOrders();
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
    <div style={{ padding: 16 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>My Orders</h1>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        {FILTER_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setFilter(option.value)}
            style={{
              padding: "6px 12px",
              borderRadius: 8,
              border: "1px solid #444",
              background: filter === option.value ? "#222" : "transparent",
              color: "inherit",
              cursor: "pointer",
            }}
          >
            {option.label}
          </button>
        ))}
      </div>
      {loading && <div>Loading orders…</div>}
      {!loading && error && (
        <div style={{ color: "crimson" }}>
          {error}
          <button
            type="button"
            onClick={() => {
              setError(null);
              setLoading(true);
              setOrders([]);
            }}
            style={{
              marginLeft: 8,
              border: "1px solid currentColor",
              background: "transparent",
              borderRadius: 6,
              padding: "2px 6px",
              cursor: "pointer",
            }}
          >
            Retry
          </button>
        </div>
      )}
      {!loading && !error && filteredOrders.length === 0 && (
        <div>
          No orders for this filter.{" "}
          <button
            type="button"
            onClick={() => navigate("/products")}
            style={{
              border: "1px solid #444",
              background: "transparent",
              borderRadius: 6,
              padding: "2px 6px",
              cursor: "pointer",
            }}
          >
            Browse products
          </button>
        </div>
      )}
      {!loading && !error && filteredOrders.length > 0 && (
        <div style={{ border: "1px solid #333", borderRadius: 12, overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "150px 140px 120px 220px 1fr", gap: 8, padding: 10, fontWeight: 700, borderBottom: "1px solid #333" }}>
            <div>Order</div>
            <div>Status</div>
            <div>Total</div>
            <div>Created</div>
            <div>Actions</div>
          </div>
          {filteredOrders.map((order) => {
            const status = normalizeStatus(order.status || order.paymentStatus);
            const shortId = (order.id || '').slice(0, 8) || '—';
            const created = order.createdAt
              ? new Date(order.createdAt).toLocaleString()
              : '—';
            return (
              <div
                key={order.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "150px 140px 120px 220px 1fr",
                  gap: 8,
                  padding: 10,
                  borderBottom: "1px solid #2a2a2a",
                }}
              >
                <div>{shortId}</div>
                <div>{status || '—'}</div>
                <div>{formatMoney(order)}</div>
                <div>{created}</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    style={{
                      padding: '6px 10px',
                      borderRadius: 8,
                      border: '1px solid #444',
                      background: 'transparent',
                      cursor: 'pointer',
                    }}
                    onClick={() => navigate(`/buyer/orders/${order.id}`)}
                  >
                    View
                  </button>
                  {isUnpaidStatus(status) && (
                    <button
                      type="button"
                      style={{
                        padding: '6px 10px',
                        borderRadius: 8,
                        border: '1px solid #444',
                        background: '#222',
                        color: 'white',
                        cursor: 'pointer',
                      }}
                      onClick={() => navigate(`/buyer/orders/${order.id}`)}
                    >
                      Pay now
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
