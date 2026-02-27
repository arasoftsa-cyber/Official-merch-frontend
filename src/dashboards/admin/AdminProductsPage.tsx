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
  artist_id?: string;
  isActive?: boolean;
  is_active?: boolean;
  status?: string;
  primaryPhotoUrl?: string;
  listingPhotoUrl?: string;
  listingPhotoUrls?: string[];
};

export default function AdminProductsPage() {
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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
        <div className="flex items-center gap-3">
          <Link
            to="/partner/admin/products/new"
            className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm text-white"
          >
            Create Product
          </Link>
          <Link className="text-sm text-slate-300 underline" to="/partner/admin">
            Back to dashboard
          </Link>
        </div>
      </div>

      {error && <p className="text-sm text-rose-300">{error}</p>}

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
        <table className="w-full text-sm text-white">
          <thead>
            <tr className="border-b border-white/10 text-left text-xs uppercase tracking-[0.35em] text-slate-400">
              <th className="px-4 py-3">Photo</th>
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">Artist</th>
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
              const statusLabel =
                typeof product.status === 'string' && product.status.trim().length > 0
                  ? product.status.toLowerCase()
                  : active
                  ? 'active'
                  : 'inactive';
              const artistId = product.artistId || product.artist_id || '';
              const thumbnail =
                product.listingPhotoUrl ||
                product.primaryPhotoUrl ||
                (Array.isArray(product.listingPhotoUrls) ? product.listingPhotoUrls[0] : '');

              return (
                <tr key={product.id} className="border-b border-white/5">
                  <td className="px-4 py-3">
                    {thumbnail ? (
                      <img
                        src={thumbnail}
                        alt={`${product.title ?? 'Product'} thumbnail`}
                        className="h-10 w-10 rounded-md border border-white/15 object-cover"
                      />
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3">{product.title ?? '-'}</td>
                  <td className="px-4 py-3">{artistLabelById[artistId] || artistId || '-'}</td>
                  <td className="px-4 py-3">{statusLabel}</td>
                  <td className="space-x-2 px-4 py-3 text-right">
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
          <div className="w-full max-w-xl space-y-4 rounded-2xl border border-white/10 bg-slate-950/95 p-6 shadow-xl">
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
