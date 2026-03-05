import React, { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { apiGet } from '../../lib/api';
import { getAccessToken } from '../../shared/auth/tokenStore';
import { API_BASE } from '../../shared/api/http';
import { useToast } from '../../components/ux/ToastHost';
import { Page, Container } from '../../ui/Page';

const formatUpdatedDate = (product: any) => {
  const raw =
    product?.updated_at ??
    product?.updatedAt ??
    product?.created_at ??
    product?.createdAt ??
    null;
  if (!raw) {
    return '-';
  }
  const date = new Date(raw);
  return Number.isNaN(date.getTime())
    ? String(raw)
    : date.toLocaleString('en-US', { hour12: false });
};

const getProductId = (product: any) => product?.id ?? product?.productId ?? null;

const isProductActive = (product: any) => {
  if (typeof product?.is_active === 'boolean') return product.is_active;
  if (typeof product?.isActive === 'boolean') return product.isActive;
  const status = (product?.status ?? '').toLowerCase();
  if (status === 'inactive' || status === 'hidden') return false;
  return true;
};

export default function ArtistProductsPage() {
  const token = getAccessToken();
  const navigate = useNavigate();
  const toast = useToast();
  const [products, setProducts] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingIds, setPendingIds] = useState<Record<string, boolean>>({});

  const loadProducts = async () => {
    setLoading(true);
    setError(null);
    try {
      const payload: any = await apiGet('/api/artist/products');
      const items = Array.isArray(payload?.items)
        ? payload.items
        : Array.isArray(payload)
          ? payload
          : [];
      setProducts(items);
    } catch (err: any) {
      setError(err?.message ?? 'Unable to load products');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const setPending = (productId: string, pending: boolean) => {
    setPendingIds((prev) => {
      const next = { ...prev };
      if (pending) {
        next[productId] = true;
      } else {
        delete next[productId];
      }
      return next;
    });
  };

  const toggleProductActive = async (product: any) => {
    const productId = getProductId(product);
    if (!productId || !token) {
      return;
    }

    const current = isProductActive(product);
    const nextActive = !current;

    setPending(productId, true);
    setProducts((prev) =>
      prev.map((item) => {
        if (getProductId(item) !== productId) return item;
        return {
          ...item,
          is_active: nextActive,
          isActive: nextActive,
          status: nextActive ? 'active' : 'inactive',
        };
      })
    );

    try {
      const response = await fetch(`${API_BASE}/api/products/${productId}/status`, {
        method: 'PATCH',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        credentials: 'include',
        body: JSON.stringify({ active: nextActive }),
      });

      if (!response.ok) {
        const fallback = await fetch(`${API_BASE}/api/products/${productId}`, {
          method: 'PATCH',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          credentials: 'include',
          body: JSON.stringify({ active: nextActive }),
        });

        if (!fallback.ok) {
          const payloadError = await fallback.json().catch(() => null);
          const message =
            payloadError?.message ??
            payloadError?.error ??
            `Server error (${fallback.status})`;
          throw new Error(message);
        }
      }

      toast.notify(`Product set to ${nextActive ? 'active' : 'inactive'}`, 'success');
      await loadProducts();
    } catch (err: any) {
      setProducts((prev) =>
        prev.map((item) => {
          if (getProductId(item) !== productId) return item;
          return {
            ...item,
            is_active: current,
            isActive: current,
            status: current ? 'active' : 'inactive',
          };
        })
      );
      toast.notify(err?.message ?? 'Failed to update product status', 'error');
    } finally {
      setPending(productId, false);
    }
  };

  const visibleProducts = products.filter((product) => {
    const active = isProductActive(product);
    if (statusFilter === 'active') return active;
    if (statusFilter === 'inactive') return !active;
    return true;
  });

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return (
    <Page>
      <Container className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-slate-500 dark:text-slate-400">Artist</p>
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Artist Products</h1>
          </div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-slate-600 dark:text-slate-300">
            <span>Status</span>
            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as 'all' | 'active' | 'inactive')
              }
              className="rounded-full border border-slate-200 dark:border-white/20 bg-white dark:bg-slate-900 px-3 py-1 text-xs text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-slate-400 dark:focus:ring-white/40"
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>

        {loading && <p className="text-slate-500 dark:text-slate-400">Loading products...</p>}
        {error && (
          <p role="alert" className="text-sm text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 px-4 py-2 rounded-lg border border-rose-200 dark:border-rose-500/20">
            {error}
          </p>
        )}

        {!loading && !error && (
          <>
            <div className="mt-6 flex justify-center">
              <div className="w-full max-w-[1200px]">
                <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 shadow-lg">
                  <table className="w-full table-fixed text-sm text-slate-900 dark:text-white">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-transparent text-[10px] uppercase tracking-[0.4em] text-slate-500 dark:text-slate-400">
                        <th className="w-[45%] px-6 py-3 text-left">Title</th>
                        <th className="w-[18%] px-6 py-3 text-left">Status</th>
                        <th className="w-[18%] px-6 py-3 text-left">Updated</th>
                        <th className="w-[19%] px-6 py-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                      {visibleProducts.map((product, index) => {
                        const title = product?.title ?? product?.name ?? '-';
                        const productId = getProductId(product) ?? `${title}-${index}`;
                        const active = isProductActive(product);
                        const pending = Boolean(getProductId(product) && pendingIds[String(getProductId(product))]);

                        return (
                          <tr key={productId} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                            <td className="w-[45%] px-6 py-4">
                              <div className="font-medium">{title}</div>
                            </td>
                            <td className="w-[18%] px-6 py-4">
                              <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${active ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-400'}`}>
                                {active ? 'active' : 'inactive'}
                              </span>
                            </td>
                            <td className="w-[18%] px-6 py-4 text-slate-600 dark:text-white/90">{formatUpdatedDate(product)}</td>
                            <td className="w-[19%] px-6 py-4 text-right">
                              <button
                                type="button"
                                disabled={pending}
                                className="rounded-full border border-slate-300 dark:border-white/20 bg-white dark:bg-transparent px-3 py-1 text-xs uppercase tracking-[0.3em] text-slate-700 dark:text-white hover:bg-slate-50 dark:hover:bg-white/10 transition-colors disabled:opacity-50"
                                onClick={() => toggleProductActive(product)}
                              >
                                {pending ? 'Saving...' : active ? 'Set inactive' : 'Set active'}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {visibleProducts.length === 0 && (
                  <p className="px-6 py-8 text-center text-slate-500 dark:text-slate-400 italic font-medium">No products for this filter.</p>
                )}
              </div>
            </div>

            <p className="mt-8 flex justify-center">
              <button
                type="button"
                className="group flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                onClick={() => navigate('/partner/artist')}
              >
                <span>← Go to dashboard</span>
              </button>
            </p>
          </>
        )}
      </Container>
    </Page>
  );
}
