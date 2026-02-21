import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiFetch } from '../../shared/api/http';

type Artist = {
  id: string;
  handle?: string;
  name?: string;
};

type Product = {
  id: string;
  title?: string;
  description?: string;
  artistId?: string;
  isActive?: boolean;
  is_active?: boolean;
  minVariantPriceCents?: number;
  priceCents?: number;
};

const centsToDollars = (cents?: number) => {
  if (typeof cents !== 'number' || !Number.isFinite(cents)) return '';
  return (cents / 100).toFixed(2);
};

export default function AdminProductsPage() {
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [createArtistId, setCreateArtistId] = useState('');
  const [createTitle, setCreateTitle] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [createPrice, setCreatePrice] = useState('19.99');
  const [createStock, setCreateStock] = useState('10');
  const [createActive, setCreateActive] = useState(true);

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editActive, setEditActive] = useState(true);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [productsPayload, artistsPayload] = await Promise.all([
        apiFetch('/admin/products'),
        apiFetch('/artists'),
      ]);

      const productItems = Array.isArray(productsPayload?.items)
        ? productsPayload.items
        : Array.isArray(productsPayload)
        ? productsPayload
        : [];
      const artistItems = Array.isArray(artistsPayload?.artists)
        ? artistsPayload.artists
        : Array.isArray(artistsPayload)
        ? artistsPayload
        : [];

      setProducts(productItems);
      setArtists(artistItems);
      if (!createArtistId && artistItems.length > 0) {
        setCreateArtistId(artistItems[0].id);
      }
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load admin products');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const artistLabelById = useMemo(() => {
    const map: Record<string, string> = {};
    artists.forEach((artist) => {
      const label = artist?.name || artist?.handle || artist?.id;
      map[artist.id] = label;
    });
    return map;
  }, [artists]);

  const submitCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!createArtistId || !createTitle.trim()) {
      setError('Artist and title are required.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await apiFetch('/admin/products', {
        method: 'POST',
        body: {
          artistId: createArtistId,
          title: createTitle.trim(),
          description: createDescription.trim(),
          price: createPrice,
          stock: Number(createStock) || 0,
          isActive: createActive,
        },
      });

      setCreateTitle('');
      setCreateDescription('');
      setCreatePrice('19.99');
      setCreateStock('10');
      setCreateActive(true);
      await load();
    } catch (err: any) {
      setError(err?.message ?? 'Failed to create product');
    } finally {
      setSaving(false);
    }
  };

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setEditTitle(product.title ?? '');
    setEditDescription(product.description ?? '');
    setEditActive(Boolean(product.isActive ?? product.is_active));
    setIsEditOpen(true);
  };

  const closeEditModal = () => {
    setIsEditOpen(false);
    setEditingProduct(null);
    setEditTitle('');
    setEditDescription('');
    setEditActive(true);
  };

  const saveEdit = async () => {
    if (!editingProduct?.id) return;

    setSaving(true);
    setError(null);

    try {
      await apiFetch(`/admin/products/${editingProduct.id}`, {
        method: 'PATCH',
        body: {
        title: editTitle.trim(),
        description: editDescription.trim(),
        isActive: editActive,
        },
      });

      closeEditModal();
      await load();
    } catch (err: any) {
      setError(err?.message ?? 'Failed to update product');
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Admin</p>
          <h1 className="text-2xl font-semibold text-white">Products</h1>
        </div>
        <Link className="text-sm text-slate-300 underline" to="/partner/admin">
          Back to dashboard
        </Link>
      </div>

      {error && <p className="text-sm text-rose-300">{error}</p>}

      <form onSubmit={submitCreate} className="grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 md:grid-cols-6">
        <select
          data-testid="admin-product-artist-select"
          value={createArtistId}
          onChange={(e) => setCreateArtistId(e.target.value)}
          className="rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-sm text-white md:col-span-2"
        >
          <option value="">Select artist</option>
          {artists.map((artist) => (
            <option key={artist.id} value={artist.id}>
              {artist.name || artist.handle || artist.id}
            </option>
          ))}
        </select>
        <input
          value={createTitle}
          onChange={(e) => setCreateTitle(e.target.value)}
          placeholder="Title"
          className="rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-sm text-white md:col-span-2"
        />
        <input
          value={createPrice}
          onChange={(e) => setCreatePrice(e.target.value)}
          placeholder="Price"
          className="rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-sm text-white"
        />
        <input
          value={createStock}
          onChange={(e) => setCreateStock(e.target.value)}
          placeholder="Stock"
          className="rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-sm text-white"
        />
        <input
          value={createDescription}
          onChange={(e) => setCreateDescription(e.target.value)}
          placeholder="Description"
          className="rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-sm text-white md:col-span-4"
        />
        <label className="flex items-center gap-2 text-sm text-slate-200">
          <input
            type="checkbox"
            checked={createActive}
            onChange={(e) => setCreateActive(e.target.checked)}
          />
          Active
        </label>
        <button
          type="submit"
          disabled={saving}
          className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          Create product
        </button>
      </form>

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
        <table className="w-full text-sm text-white">
          <thead>
            <tr className="border-b border-white/10 text-left text-xs uppercase tracking-[0.35em] text-slate-400">
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">Artist</th>
              <th className="px-4 py-3">Price</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {!loading && products.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-4 text-slate-300">
                  No products returned.
                </td>
              </tr>
            )}
            {products.map((product) => {
              const active = Boolean(product.isActive ?? product.is_active);
              const priceLabel = centsToDollars(product.minVariantPriceCents ?? product.priceCents);
              return (
                <tr key={product.id} className="border-b border-white/5">
                  <td className="px-4 py-3">{product.title ?? '-'}</td>
                  <td className="px-4 py-3">{artistLabelById[product.artistId || ''] || product.artistId || '-'}</td>
                  <td className="px-4 py-3">{priceLabel ? `$${priceLabel}` : '-'}</td>
                  <td className="px-4 py-3">{active ? 'active' : 'inactive'}</td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button
                      type="button"
                      onClick={() => openEditModal(product)}
                      className="rounded-lg border border-white/20 px-3 py-1 text-xs uppercase tracking-[0.25em]"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate(`/partner/admin/products/${product.id}/variants`)}
                      className="rounded-lg border border-white/20 px-3 py-1 text-xs uppercase tracking-[0.25em]"
                    >
                      Variants
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {isEditOpen && editingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-slate-950/95 p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg text-white">Edit product</h2>
              <button
                type="button"
                onClick={closeEditModal}
                className="rounded-lg border border-white/20 px-2 py-1 text-xs text-white"
              >
                Close
              </button>
            </div>

            <input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              placeholder="Title"
              className="w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-sm text-white"
            />
            <textarea
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              placeholder="Description"
              rows={3}
              className="w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-sm text-white"
            />
            <label className="flex items-center gap-2 text-sm text-slate-200">
              <input
                type="checkbox"
                checked={editActive}
                onChange={(e) => setEditActive(e.target.checked)}
              />
              Active
            </label>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={saveEdit}
                disabled={saving}
                className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm text-white disabled:opacity-50"
              >
                Save
              </button>
              <button
                type="button"
                onClick={closeEditModal}
                className="rounded-xl border border-white/20 px-4 py-2 text-sm text-white"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
