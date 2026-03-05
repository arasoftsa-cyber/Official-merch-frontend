import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getAccessToken } from '../../shared/auth/tokenStore';
import { API_BASE, apiFetch } from '../../shared/api/http';

type Variant = {
  id?: string;
  sku: string;
  size: string;
  color: string;
  priceCents: number;
  stock: number;
};

export default function AdminProductVariants() {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const [variants, setVariants] = useState<Variant[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!productId) return;
    setLoading(true);
    setError(null);
    try {
      const payload = await apiFetch(`/api/admin/products/${productId}/variants`);
      const items = Array.isArray(payload?.variants)
        ? payload.variants
        : Array.isArray(payload)
          ? payload
          : [];
      setVariants(items);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load variants');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [productId]);

  const updateVariant = (index: number, key: keyof Variant, value: string) => {
    setVariants((prev) =>
      prev.map((row, i) => {
        if (i !== index) return row;
        if (key === 'priceCents' || key === 'stock') {
          return { ...row, [key]: Number(value) || 0 };
        }
        return { ...row, [key]: value };
      })
    );
  };

  const addVariant = () => {
    setVariants((prev) => [
      ...prev,
      { sku: '', size: '', color: '', priceCents: 0, stock: 0 },
    ]);
  };

  const removeVariant = (index: number) => {
    setVariants((prev) => prev.filter((_, i) => i !== index));
  };

  const saveAll = async () => {
    if (!productId) return;
    setSaving(true);
    setError(null);
    try {
      const normalizedVariants = variants.map((v) => {
        const priceCentsNum = Number(String(v.priceCents ?? '').trim());
        const unitsNum = Number(String(v.stock ?? '').trim());
        const normalizedUnits = Number.isFinite(unitsNum) ? unitsNum : 0;
        return {
          id: v.id,
          sku: String(v.sku ?? ''),
          size: String(v.size ?? ''),
          color: String(v.color ?? ''),
          priceCents: Number.isFinite(priceCentsNum) ? priceCentsNum : 0,
          stock: normalizedUnits,
          units: normalizedUnits,
        };
      });
      const payload = { variants: normalizedVariants };
      console.log('[variants] PUT payload', payload);

      const token = getAccessToken();
      const response = await fetch(`${API_BASE}/api/admin/products/${productId}/variants`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const text = await response.text().catch(() => '');
        console.error('[variants] PUT failed', response.status, text);
        throw new Error(text || `HTTP_${response.status}`);
      }

      await load();
    } catch (err: any) {
      setError(err?.message ?? 'Failed to save variants');
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 dark:text-slate-500">Admin Inventory</p>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white">Product Variants</h1>
        </div>
        <Link
          to="/partner/admin/products"
          className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-white transition-all border border-slate-200 dark:border-white/10 px-4 py-1.5 rounded-full"
        >
          Back to items
        </Link>
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-200 dark:border-rose-400/40 bg-rose-50 dark:bg-rose-500/10 p-4">
          <p className="text-xs font-black uppercase tracking-widest text-rose-600 dark:text-rose-400">{error}</p>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-12">
          <p className="text-xs font-black uppercase tracking-widest text-slate-400 animate-pulse">Synchronizing Variants...</p>
        </div>
      )}

      {!loading && (
        <div className="space-y-6">
          <div className="space-y-3">
            <div className="mb-4 hidden grid-cols-6 gap-4 px-6 text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500 md:grid">
              <div>Stock Code (SKU)</div>
              <div>Size</div>
              <div>Color</div>
              <div>Price (Cents)</div>
              <div>Units</div>
              <div className="text-right">Actions</div>
            </div>

            <div className="space-y-3">
              {variants.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-slate-200 dark:border-white/10 p-12 text-center">
                  <p className="text-xs font-black uppercase tracking-widest text-slate-400">No variant configurations found.</p>
                </div>
              ) : (
                variants.map((variant, index) => (
                  <div
                    key={`${variant.id || 'new'}-${index}`}
                    className="group grid grid-cols-1 gap-4 rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 p-4 md:grid-cols-6 items-center shadow-sm hover:border-indigo-400 dark:hover:border-white/40 transition-all duration-300"
                  >
                    <input
                      value={variant.sku}
                      onChange={(e) => updateVariant(index, 'sku', e.target.value)}
                      placeholder="SKU-001"
                      className="w-full rounded-2xl border border-slate-100 dark:border-white/10 bg-slate-50 dark:bg-black/30 px-4 py-2 text-xs font-bold text-slate-900 dark:text-white focus:border-indigo-500 dark:focus:border-white/40 transition outline-none"
                    />
                    <input
                      value={variant.size}
                      onChange={(e) => updateVariant(index, 'size', e.target.value)}
                      placeholder="Size"
                      className="w-full rounded-2xl border border-slate-100 dark:border-white/10 bg-slate-50 dark:bg-black/30 px-4 py-2 text-xs font-bold text-slate-900 dark:text-white focus:border-indigo-500 dark:focus:border-white/40 transition outline-none"
                    />
                    <input
                      value={variant.color}
                      onChange={(e) => updateVariant(index, 'color', e.target.value)}
                      placeholder="Color"
                      className="w-full rounded-2xl border border-slate-100 dark:border-white/10 bg-slate-50 dark:bg-black/30 px-4 py-2 text-xs font-bold text-slate-900 dark:text-white focus:border-indigo-500 dark:focus:border-white/40 transition outline-none"
                    />
                    <input
                      type="number"
                      value={variant.priceCents}
                      onChange={(e) => updateVariant(index, 'priceCents', e.target.value)}
                      className="w-full rounded-2xl border border-slate-100 dark:border-white/10 bg-slate-50 dark:bg-black/30 px-4 py-2 text-xs font-black text-slate-900 dark:text-white focus:border-indigo-500 dark:focus:border-white/40 transition outline-none"
                    />
                    <input
                      type="number"
                      value={variant.stock}
                      onChange={(e) => updateVariant(index, 'stock', e.target.value)}
                      className="w-full rounded-2xl border border-slate-100 dark:border-white/10 bg-slate-50 dark:bg-black/30 px-4 py-2 text-xs font-black text-slate-900 dark:text-white focus:border-indigo-500 dark:focus:border-white/40 transition outline-none"
                    />
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => removeVariant(index)}
                        className="rounded-full bg-rose-50 dark:bg-rose-500/10 p-2 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-500/20 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                        title="Delete Configuration"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="sticky bottom-0 z-20 flex flex-wrap items-center gap-4 py-8 border-t border-slate-100 dark:border-white/5 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl">
            <button
              type="button"
              onClick={addVariant}
              className="rounded-full border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-8 py-3 text-xs font-black uppercase tracking-widest text-slate-900 dark:text-white hover:bg-slate-50 dark:hover:bg-white/10 transition-all active:scale-95"
            >
              Add New Config
            </button>
            <button
              type="button"
              onClick={saveAll}
              disabled={saving}
              className="rounded-full bg-slate-900 dark:bg-white px-10 py-3 text-xs font-black uppercase tracking-widest text-white dark:text-slate-950 transition-all hover:scale-[1.02] active:scale-95 shadow-xl shadow-slate-900/10 dark:shadow-none disabled:opacity-50"
            >
              {saving ? 'Syncing...' : 'Deploy Changes'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/partner/admin/products')}
              className="ml-auto text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-indigo-600 transition-colors"
            >
              Finish Review
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
