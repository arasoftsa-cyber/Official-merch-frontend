import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { apiFetch } from '../../shared/api/http';

type Variant = {
  id?: string;
  sku: string;
  size: string;
  color: string;
  priceCents: number;
  stock: number;
};

export default function AdminProductVariants() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [variants, setVariants] = useState<Variant[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const payload = await apiFetch(`/admin/products/${id}/variants`);
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
  }, [id]);

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
    if (!id) return;
    setSaving(true);
    setError(null);
    try {
      await apiFetch(`/admin/products/${id}/variants`, {
        method: 'PUT',
        body: {
          variants: variants.map((v) => ({
            id: v.id,
            sku: v.sku,
            size: v.size,
            color: v.color,
            priceCents: Number(v.priceCents),
            stock: Number(v.stock),
          })),
        },
      });
      await load();
    } catch (err: any) {
      setError(err?.message ?? 'Failed to save variants');
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Admin</p>
          <h1 className="text-2xl font-semibold text-white">Product Variants</h1>
        </div>
        <Link className="text-sm text-slate-300 underline" to="/partner/admin/products">
          Back to products
        </Link>
      </div>

      {error && <p className="text-sm text-rose-300">{error}</p>}
      {loading && <p className="text-sm text-slate-300">Loading...</p>}

      {!loading && (
        <>
          <div className="space-y-2">
            <div className="mb-1 hidden gap-2 px-1 text-xs font-medium uppercase tracking-[0.12em] text-slate-300 md:grid md:grid-cols-6">
              <div>SKU</div>
              <div>Size</div>
              <div>Color</div>
              <div>Price</div>
              <div>Stock</div>
              <div>Actions</div>
            </div>
            {variants.map((variant, index) => (
              <div key={`${variant.id || 'new'}-${index}`} className="grid gap-2 rounded-xl border border-white/10 bg-white/5 p-3 md:grid-cols-6">
                <input
                  value={variant.sku}
                  onChange={(e) => updateVariant(index, 'sku', e.target.value)}
                  placeholder="SKU"
                  className="rounded-lg border border-white/15 bg-black/20 px-2 py-1 text-sm text-white"
                />
                <input
                  value={variant.size}
                  onChange={(e) => updateVariant(index, 'size', e.target.value)}
                  placeholder="Size"
                  className="rounded-lg border border-white/15 bg-black/20 px-2 py-1 text-sm text-white"
                />
                <input
                  value={variant.color}
                  onChange={(e) => updateVariant(index, 'color', e.target.value)}
                  placeholder="Color"
                  className="rounded-lg border border-white/15 bg-black/20 px-2 py-1 text-sm text-white"
                />
                <input
                  value={variant.priceCents}
                  onChange={(e) => updateVariant(index, 'priceCents', e.target.value)}
                  placeholder="Price cents"
                  className="rounded-lg border border-white/15 bg-black/20 px-2 py-1 text-sm text-white"
                />
                <input
                  value={variant.stock}
                  onChange={(e) => updateVariant(index, 'stock', e.target.value)}
                  placeholder="Stock"
                  className="rounded-lg border border-white/15 bg-black/20 px-2 py-1 text-sm text-white"
                />
                <button
                  type="button"
                  onClick={() => removeVariant(index)}
                  className="rounded-lg border border-white/20 px-3 py-1 text-xs uppercase tracking-[0.25em] text-white"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={addVariant}
              className="rounded-xl border border-white/20 px-4 py-2 text-sm text-white"
            >
              Add variant
            </button>
            <button
              type="button"
              onClick={saveAll}
              disabled={saving}
              className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save variants'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/partner/admin/products')}
              className="rounded-xl border border-white/20 px-4 py-2 text-sm text-white"
            >
              Done
            </button>
          </div>
        </>
      )}
    </main>
  );
}
