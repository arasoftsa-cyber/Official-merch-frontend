import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { API_BASE } from '../../shared/api/http';
import { getAccessToken } from '../../shared/auth/tokenStore';
import { useToast } from '../../components/ux/ToastHost';

type ProductResponse = {
  product?: {
    id: string;
    title?: string;
  };
  variants?: Array<{
    id?: string;
    sku?: string;
    size?: string;
    color?: string;
    priceCents?: number;
    stock?: number;
  }>;
};

type EditableVariant = {
  id?: string;
  sku: string;
  size: string;
  color: string;
  price: string;
  stock: string;
};

const formatMoneyInput = (value?: number): string =>
  value != null ? `${(value / 100).toFixed(2)}` : '0.00';

const toCents = (text: string): number => {
  const parsed = Number(text);
  if (!Number.isFinite(parsed)) return NaN;
  return Math.round(parsed * 100);
};

const isAbort = (e: unknown) =>
  (e &&
    typeof e === 'object' &&
    'name' in e &&
    (e as any).name === 'AbortError') ||
  (typeof DOMException !== 'undefined' &&
    e instanceof DOMException &&
    e.name === 'AbortError') ||
  (e &&
    typeof e === 'object' &&
    'code' in e &&
    (e as any).code === 'ABORT_ERR') ||
  String((e as any)?.message ?? e).toLowerCase().includes('aborted') &&
    String((e as any)?.message ?? e).toLowerCase().includes('signal');

export default function ArtistProductVariantsPage() {
  const { id } = useParams<{ id: string }>();
  const authToken = getAccessToken();
  const toast = useToast();
  const [productTitle, setProductTitle] = useState<string | null>(null);
  const [variants, setVariants] = useState<EditableVariant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const buildHeaders = (contentType?: string) => {
    const headers: Record<string, string> = {
      Accept: 'application/json',
    };
    if (contentType) {
      headers['Content-Type'] = contentType;
    }
    if (authToken) {
      headers.Authorization = `Bearer ${authToken}`;
    }
    return headers;
  };

  const loadProductInfo = async (
    signal?: AbortSignal,
    isAlive: () => boolean = () => true
  ) => {
    if (!id) return;
    try {
      const response = await fetch(`${API_BASE}/api/products/${id}`, {
        method: 'GET',
        headers: buildHeaders(),
        credentials: 'include',
        signal,
      });
      if (signal?.aborted || !isAlive()) return;
      if (!response.ok) {
        if (isAlive()) setProductTitle('Product');
        return;
      }
      const payload = (await response.json().catch(() => null)) as ProductResponse;
      if (signal?.aborted || !isAlive()) return;
      if (payload?.product) {
        setProductTitle(payload.product?.title ?? payload.product?.id ?? 'Product');
        return;
      }
    } catch (err: any) {
      if (isAbort(err)) return;
    }
    if (isAlive()) setProductTitle('Product');
  };

  const loadVariants = async (
    signal?: AbortSignal,
    isAlive: () => boolean = () => true
  ) => {
    if (!id) return;
    try {
      const response = await fetch(`${API_BASE}/api/products/${id}/variants`, {
        method: 'GET',
        headers: buildHeaders(),
        credentials: 'include',
        signal,
      });
      if (signal?.aborted || !isAlive()) return;
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message ?? payload?.error ?? response.statusText);
      }
      const payload = (await response.json().catch(() => null)) as {
        productId?: string;
        variants?: Array<EditableVariant & { priceCents?: number }>;
      };
      const variantList = Array.isArray(payload.variants) ? payload.variants : [];
      if (signal?.aborted || !isAlive()) return;
      setVariants(
        variantList.map((variant) => ({
          id: variant.id,
          size: variant.size ?? 'M',
          color: variant.color ?? '',
          sku: variant.sku ?? '',
          price: formatMoneyInput(variant.priceCents),
          stock:
            typeof variant.stock === 'number' && !Number.isNaN(variant.stock)
              ? String(variant.stock)
              : '0',
        }))
      );
    } catch (err: any) {
      if (isAbort(err)) return;
      if (isAlive()) setError(err?.message ?? 'Failed to load variants');
    }
  };

  useEffect(() => {
    if (!id) {
      setError('Missing product id');
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    let alive = true;
    const isAlive = () => alive && !controller.signal.aborted;
    setLoading(true);
    setError(null);
    const run = async () => {
      try {
        await Promise.all([
          loadProductInfo(controller.signal, isAlive),
          loadVariants(controller.signal, isAlive),
        ]);
      } catch (err: any) {
        if (!isAlive() || controller.signal.aborted || isAbort(err)) return;
        throw err;
      }
      if (isAlive()) {
        setLoading(false);
      }
    };
    void run().catch((err: any) => {
      if (!isAlive() || controller.signal.aborted || isAbort(err)) return;
      if (isAlive()) {
        setError(err?.message ?? 'Failed to load variants');
        setLoading(false);
      }
      console.error(err);
    });
    return () => {
      alive = false;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, authToken]);

  const addVariant = () => {
    setMessage(null);
    setVariants((prev) => [
      ...prev,
      { sku: '', size: 'M', color: '', price: '0.00', stock: '0' },
    ]);
  };

  const deleteVariant = async (variantId: string): Promise<string | null> => {
    try {
      const response = await fetch(
        `${API_BASE}/api/product-variants/${variantId}`,
        {
          method: 'DELETE',
          headers: buildHeaders(),
          credentials: 'include',
        }
      );
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        return payload?.message ?? payload?.error ?? response.statusText;
      }
      return null;
    } catch (err: any) {
      if (isAbort(err)) return null;
      return err?.message ?? 'Failed to delete variant.';
    }
  };

  const removeVariant = async (index: number) => {
    setMessage(null);
    const variant = variants[index];
    if (variant?.id) {
      setSaving(true);
      try {
        const deleteError = await deleteVariant(variant.id);
        if (deleteError) {
          setError(deleteError);
          return;
        }
        toast.notify('Variant removed.', 'success');
        setVariants((prev) => prev.filter((_, idx) => idx !== index));
    } catch (err: any) {
        if (isAbort(err)) return;
        setError(err?.message ?? 'Failed to delete variant.');
    } finally {
      setSaving(false);
    }
      return;
    }
    setVariants((prev) => prev.filter((_, idx) => idx !== index));
  };

  const updateVariantField = (
    index: number,
    field: keyof EditableVariant,
    value: string
  ) => {
    setVariants((prev) =>
      prev.map((variant, idx) =>
        idx === index ? { ...variant, [field]: value } : variant
      )
    );
  };

  const validateVariants = (): string | null => {
    if (variants.length === 0) {
      return 'Add at least one variant before saving.';
    }
    for (const variant of variants) {
      if (!variant.size.trim()) {
        return 'Each variant needs a size.';
      }
      if (!variant.color.trim()) {
        return 'Each variant needs a color.';
      }
      if (!variant.sku.trim()) {
        return 'Each variant needs a SKU.';
      }
      const priceCents = toCents(variant.price);
      if (!Number.isFinite(priceCents) || priceCents <= 0) {
        return 'Each variant needs a valid price.';
      }
      const stockNumber = Number(variant.stock);
      if (!Number.isInteger(stockNumber) || stockNumber < 0) {
        return 'Each variant needs a valid stock value.';
      }
    }
    return null;
  };

  const saveVariants = async () => {
    if (!id) return;
    const validationError = validateVariants();
    if (validationError) {
      setError(validationError);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        variants: variants.map((variant) => ({
          id: variant.id,
          size: variant.size.trim(),
          color: variant.color.trim(),
          sku: variant.sku.trim(),
          priceCents: toCents(variant.price),
          stock: Number(variant.stock),
        })),
      };
      const response = await fetch(`${API_BASE}/api/products/${id}/variants`, {
        method: 'PUT',
        headers: buildHeaders('application/json'),
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message ?? payload?.error ?? response.statusText);
      }
      setMessage('Variants saved');
      toast.notify('Variants saved.', 'success');
      await loadVariants();
    } catch (err: any) {
      if (isAbort(err)) return;
      setError(err?.message ?? 'Failed to save variants.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <main className="p-6">
        <p>Loading variants…</p>
      </main>
    );
  }

  return (
    <main className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-slate-400">
            Artist
          </p>
          <h1 className="text-2xl font-semibold text-white">Manage Variants</h1>
          {productTitle && (
            <p className="text-sm text-slate-300">Product: {productTitle}</p>
          )}
        </div>
        <Link
          to="/partner/artist/products"
          className="rounded-full border border-white/30 px-4 py-2 text-xs uppercase tracking-[0.3em] text-white"
        >
          Back to products
        </Link>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}
      {message && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          {message}
        </div>
      )}

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-[0.65rem] uppercase tracking-[0.35em] text-slate-400">
          <span className="w-24">Size</span>
          <span className="w-24">Color</span>
          <span className="w-32">SKU</span>
          <span className="w-24">Price</span>
          <span className="w-20">Stock</span>
          <span className="w-28 text-right">Action</span>
        </div>
        {variants.map((variant, index) => (
          <div
            key={variant.id ?? `variant-${index}`}
            className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3"
          >
            <input
              className="w-24 rounded border border-white/10 bg-black/20 px-2 py-1 text-xs text-white"
              placeholder="Size"
              value={variant.size}
              onChange={(event) =>
                updateVariantField(index, 'size', event.target.value)
              }
            />
            <input
              className="w-24 rounded border border-white/10 bg-black/20 px-2 py-1 text-xs text-white"
              placeholder="Color"
              value={variant.color}
              onChange={(event) =>
                updateVariantField(index, 'color', event.target.value)
              }
            />
            <input
              className="w-32 rounded border border-white/10 bg-black/20 px-2 py-1 text-xs text-white"
              placeholder="SKU"
              value={variant.sku}
              onChange={(event) =>
                updateVariantField(index, 'sku', event.target.value)
              }
            />
            <input
              type="number"
              min="0"
              step="0.01"
              className="w-24 rounded border border-white/10 bg-black/20 px-2 py-1 text-xs text-white"
              placeholder="Price"
              value={variant.price}
              onChange={(event) =>
                updateVariantField(index, 'price', event.target.value)
              }
            />
            <input
              type="number"
              min="0"
              step="1"
              className="w-20 rounded border border-white/10 bg-black/20 px-2 py-1 text-xs text-white"
              placeholder="Stock"
              value={variant.stock}
              onChange={(event) =>
                updateVariantField(index, 'stock', event.target.value)
              }
            />
            <button
              type="button"
              className="rounded-full border border-white/20 px-3 py-1 text-xs uppercase tracking-[0.3em] text-white/70"
              onClick={() => removeVariant(index)}
              disabled={saving}
            >
              Remove
            </button>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="rounded-full border border-white/20 px-4 py-2 text-xs uppercase tracking-[0.3em] text-white"
          onClick={addVariant}
          disabled={saving}
        >
          Add Variant
        </button>
        <button
          type="button"
          className="rounded-full border border-emerald-500/40 bg-emerald-500/20 px-4 py-2 text-xs uppercase tracking-[0.3em] text-emerald-100"
          onClick={saveVariants}
          disabled={saving}
        >
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </main>
  );
}
