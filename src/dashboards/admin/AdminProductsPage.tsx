import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiFetch, apiFetchForm } from '../../shared/api/http';

type Artist = {
  id: string;
  handle?: string;
  name?: string;
};

type Product = {
  id: string;
  title?: string;
  name?: string;
  description?: string;
  merch_story?: string;
  merchStory?: string;
  merch_type?: string;
  merchType?: string;
  vendor_pay?: number | string;
  vendorPay?: number | string;
  vendor_pay_cents?: number;
  vendorPayCents?: number;
  vendor_payout_cents?: number;
  vendorPayoutCents?: number;
  our_share?: number | string;
  ourShare?: number | string;
  our_share_cents?: number;
  ourShareCents?: number;
  royalty?: number | string;
  royalty_cents?: number;
  royaltyCents?: number;
  colors?: string[] | string;
  artistId?: string;
  artist_id?: string;
  isActive?: boolean;
  is_active?: boolean;
  active?: boolean;
  status?: string;
  primaryPhotoUrl?: string;
  listingPhotoUrl?: string;
  listingPhotoUrls?: string[];
  photoUrls?: string[];
  photos?: string[];
};

type FieldErrors = Record<string, string>;

const COLOR_OPTIONS = ['black', 'white', 'yellow', 'maroon', 'navy_blue'] as const;
const MERCH_TYPE_OPTIONS = ['tshirt', 'hoodie', 'cap', 'poster', 'other'] as const;

const readText = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const firstText = (source: Record<string, any>, keys: string[]): string => {
  for (const key of keys) {
    const value = readText(source?.[key]);
    if (value) return value;
  }
  return '';
};

const parseNumberValue = (value: string): number | null => {
  const trimmed = String(value || '').trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
};

const formatMoneyInput = (source: Record<string, any>, amountKeys: string[], centsKeys: string[]): string => {
  for (const key of amountKeys) {
    const value = source?.[key];
    if (value === undefined || value === null || value === '') continue;
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric < 0) continue;
    return `${numeric}`;
  }
  for (const key of centsKeys) {
    const value = source?.[key];
    if (value === undefined || value === null || value === '') continue;
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric < 0) continue;
    const amount = numeric / 100;
    const fixed = Number.isInteger(amount) ? `${amount}` : amount.toFixed(2);
    return fixed.replace(/\.?0+$/, '');
  }
  return '';
};

const normalizeColors = (raw: unknown): string[] => {
  let parsed = raw;
  if (typeof parsed === 'string') {
    const trimmed = parsed.trim();
    if (!trimmed) return [];
    try {
      parsed = JSON.parse(trimmed);
    } catch (_err) {
      parsed = [trimmed];
    }
  }
  if (!Array.isArray(parsed)) return [];
  return Array.from(
    new Set(
      parsed
        .map((entry) => readText(entry).toLowerCase().replace(/\s+/g, '_'))
        .filter((entry) => COLOR_OPTIONS.includes(entry as (typeof COLOR_OPTIONS)[number]))
    )
  );
};

const extractListingPhotoUrls = (product: Product | null | undefined): string[] => {
  if (!product) return [];
  const candidates = [
    ...(Array.isArray(product.listingPhotoUrls) ? product.listingPhotoUrls : []),
    ...(Array.isArray(product.photoUrls) ? product.photoUrls : []),
    ...(Array.isArray(product.photos) ? product.photos : []),
    typeof product.listingPhotoUrl === 'string' ? product.listingPhotoUrl : '',
    typeof product.primaryPhotoUrl === 'string' ? product.primaryPhotoUrl : '',
  ]
    .map((entry) => String(entry || '').trim())
    .filter(Boolean);
  return Array.from(new Set(candidates)).slice(0, 4);
};

export default function AdminProductsPage() {
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editArtistId, setEditArtistId] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editVendorPay, setEditVendorPay] = useState('');
  const [editOurShare, setEditOurShare] = useState('');
  const [editRoyalty, setEditRoyalty] = useState('');
  const [editMerchType, setEditMerchType] = useState('');
  const [editColors, setEditColors] = useState<string[]>(['black']);
  const [editListingPhotoUrls, setEditListingPhotoUrls] = useState<string[]>([]);
  const [editReplacementPhotos, setEditReplacementPhotos] = useState<File[]>([]);
  const [editActive, setEditActive] = useState(true);
  const [editFieldErrors, setEditFieldErrors] = useState<FieldErrors>({});

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

  const applyEditProductToForm = (product: Product) => {
    setEditingProduct(product);
    setEditArtistId(String(product.artistId || product.artist_id || '').trim());
    setEditTitle(firstText(product as Record<string, any>, ['title', 'name']));
    setEditDescription(
      firstText(product as Record<string, any>, ['merch_story', 'merchStory', 'description'])
    );
    setEditVendorPay(
      formatMoneyInput(
        product as Record<string, any>,
        ['vendor_pay', 'vendorPay'],
        ['vendor_pay_cents', 'vendorPayCents', 'vendor_payout_cents', 'vendorPayoutCents']
      )
    );
    setEditOurShare(
      formatMoneyInput(product as Record<string, any>, ['our_share', 'ourShare'], ['our_share_cents', 'ourShareCents'])
    );
    setEditRoyalty(
      formatMoneyInput(product as Record<string, any>, ['royalty'], ['royalty_cents', 'royaltyCents'])
    );
    setEditMerchType(firstText(product as Record<string, any>, ['merch_type', 'merchType']));
    const parsedColors = normalizeColors((product as Record<string, any>).colors);
    setEditColors(parsedColors.length > 0 ? parsedColors : ['black']);
    setEditListingPhotoUrls(extractListingPhotoUrls(product));
    setEditActive(Boolean(product.isActive ?? product.is_active ?? product.active));
  };

  const validateEditForm = (): FieldErrors => {
    const errors: FieldErrors = {};
    if (editTitle.trim().length < 2) errors.title = 'Merch Name must be at least 2 characters';
    if (editDescription.trim().length < 10) errors.merch_story = 'Merch Story must be at least 10 characters';
    const vendor = parseNumberValue(editVendorPay);
    if (vendor === null || vendor < 0) errors.vendor_pay = 'To Be Paid To Vendor must be 0 or greater';
    const ourShare = parseNumberValue(editOurShare);
    if (ourShare === null || ourShare < 0) errors.our_share = 'Our Share must be 0 or greater';
    const royalty = parseNumberValue(editRoyalty);
    if (royalty === null || royalty < 0) errors.royalty = 'Royalty must be 0 or greater';
    if (!editMerchType.trim()) errors.merch_type = 'Merch Type is required';
    if (editColors.length < 1) errors.colors = 'Select at least one color';
    if (editReplacementPhotos.length > 0 && editReplacementPhotos.length !== 4) {
      errors.listing_photos = 'Exactly 4 listing photos are required when replacing';
    }
    return errors;
  };

  const toggleEditColor = (color: string) => {
    setEditColors((prev) => {
      if (prev.includes(color)) {
        if (prev.length === 1) return prev;
        return prev.filter((entry) => entry !== color);
      }
      return [...prev, color];
    });
  };

  const openEditModal = async (product: Product) => {
    setIsEditOpen(true);
    setEditLoading(true);
    setEditError(null);
    setEditFieldErrors({});
    setEditReplacementPhotos([]);
    applyEditProductToForm(product);
    try {
      const payload = await apiFetch(`/products/${product.id}`);
      const detailProduct = (payload?.product ?? payload) as Product | null;
      if (detailProduct && typeof detailProduct === 'object') {
        applyEditProductToForm({ ...product, ...detailProduct });
      }
    } catch (err: any) {
      setEditError(err?.message ?? 'Failed to load full product details');
    } finally {
      setEditLoading(false);
    }
  };

  const closeEditModal = () => {
    setIsEditOpen(false);
    setEditLoading(false);
    setEditError(null);
    setEditFieldErrors({});
    setEditingProduct(null);
    setEditArtistId('');
    setEditTitle('');
    setEditDescription('');
    setEditVendorPay('');
    setEditOurShare('');
    setEditRoyalty('');
    setEditMerchType('');
    setEditColors(['black']);
    setEditListingPhotoUrls([]);
    setEditReplacementPhotos([]);
    setEditActive(true);
  };

  const saveEdit = async () => {
    if (!editingProduct?.id) return;

    const validationErrors = validateEditForm();
    setEditFieldErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      setEditError('Please fix the highlighted fields.');
      return;
    }

    setSaving(true);
    setEditError(null);

    try {
      await apiFetch(`/admin/products/${editingProduct.id}`, {
        method: 'PATCH',
        body: {
          title: editTitle.trim(),
          description: editDescription.trim(),
          merch_story: editDescription.trim(),
          vendor_pay: editVendorPay.trim(),
          our_share: editOurShare.trim(),
          royalty: editRoyalty.trim(),
          merch_type: editMerchType.trim(),
          colors: editColors,
          isActive: editActive,
        },
      });

      if (editReplacementPhotos.length === 4) {
        const fd = new FormData();
        editReplacementPhotos.forEach((file) => {
          fd.append('photos', file);
        });
        const photoUpdate = await apiFetchForm(`/admin/products/${editingProduct.id}/photos`, fd, {
          method: 'PUT',
        });
        const latestUrls = Array.isArray(photoUpdate?.listingPhotoUrls)
          ? photoUpdate.listingPhotoUrls.map((entry: any) => String(entry || '').trim()).filter(Boolean)
          : [];
        setEditListingPhotoUrls(latestUrls.slice(0, 4));
        setEditReplacementPhotos([]);
      }

      closeEditModal();
      await load();
    } catch (err: any) {
      setEditError(err?.message ?? 'Failed to update product');
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
          <div className="max-h-[90vh] w-full max-w-2xl space-y-4 overflow-y-auto rounded-2xl border border-white/10 bg-slate-950/95 p-6 shadow-xl">
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
            {editError && <p className="text-sm text-rose-300">{editError}</p>}

            {editLoading ? (
              <p className="text-sm text-slate-300">Loading product details...</p>
            ) : (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="text-sm text-white">
                    Artist
                    <input
                      data-testid="admin-edit-product-artist"
                      value={artistLabelById[editArtistId] || editArtistId || '-'}
                      readOnly
                      disabled
                      className="mt-2 w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-slate-300"
                    />
                    <p className="mt-1 text-xs text-slate-400">
                      Artist cannot be changed after creation.
                    </p>
                  </label>

                  <label className="text-sm text-white">
                    Merch Name
                    <input
                      data-testid="admin-edit-product-merch-name"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="mt-2 w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-sm text-white"
                    />
                    {editFieldErrors.title && (
                      <p className="mt-1 text-xs text-rose-300">{editFieldErrors.title}</p>
                    )}
                  </label>

                  <label className="text-sm text-white md:col-span-2">
                    Merch Story
                    <textarea
                      data-testid="admin-edit-product-story"
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      rows={4}
                      className="mt-2 w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-sm text-white"
                    />
                    {editFieldErrors.merch_story && (
                      <p className="mt-1 text-xs text-rose-300">{editFieldErrors.merch_story}</p>
                    )}
                  </label>

                  <label className="text-sm text-white">
                    To Be Paid To Vendor
                    <input
                      data-testid="admin-edit-product-vendor-pay"
                      type="number"
                      min={0}
                      step="0.01"
                      value={editVendorPay}
                      onChange={(e) => setEditVendorPay(e.target.value)}
                      className="mt-2 w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-sm text-white"
                    />
                    {editFieldErrors.vendor_pay && (
                      <p className="mt-1 text-xs text-rose-300">{editFieldErrors.vendor_pay}</p>
                    )}
                  </label>

                  <label className="text-sm text-white">
                    Our Share
                    <input
                      data-testid="admin-edit-product-our-share"
                      type="number"
                      min={0}
                      step="0.01"
                      value={editOurShare}
                      onChange={(e) => setEditOurShare(e.target.value)}
                      className="mt-2 w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-sm text-white"
                    />
                    {editFieldErrors.our_share && (
                      <p className="mt-1 text-xs text-rose-300">{editFieldErrors.our_share}</p>
                    )}
                  </label>

                  <label className="text-sm text-white">
                    Royalty
                    <input
                      data-testid="admin-edit-product-royalty"
                      type="number"
                      min={0}
                      step="0.01"
                      value={editRoyalty}
                      onChange={(e) => setEditRoyalty(e.target.value)}
                      className="mt-2 w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-sm text-white"
                    />
                    {editFieldErrors.royalty && (
                      <p className="mt-1 text-xs text-rose-300">{editFieldErrors.royalty}</p>
                    )}
                  </label>

                  <label className="text-sm text-white">
                    Merch Type
                    <select
                      data-testid="admin-edit-product-merch-type"
                      value={editMerchType}
                      onChange={(e) => setEditMerchType(e.target.value)}
                      className="mt-2 w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-sm text-white"
                    >
                      <option value="">Select merch type</option>
                      {MERCH_TYPE_OPTIONS.map((entry) => (
                        <option key={entry} value={entry}>
                          {entry}
                        </option>
                      ))}
                    </select>
                    {editFieldErrors.merch_type && (
                      <p className="mt-1 text-xs text-rose-300">{editFieldErrors.merch_type}</p>
                    )}
                  </label>

                  <label className="text-sm text-white">
                    Status
                    <div className="mt-3 flex items-center gap-2 text-sm text-slate-200">
                      <input
                        data-testid="admin-edit-product-active"
                        type="checkbox"
                        checked={editActive}
                        onChange={(e) => setEditActive(e.target.checked)}
                      />
                      Active
                    </div>
                  </label>

                  <fieldset
                    data-testid="admin-edit-product-colors"
                    className="rounded-xl border border-white/10 p-3 md:col-span-2"
                  >
                    <legend className="px-2 text-sm text-white">Colors</legend>
                    <div className="mt-2 flex flex-wrap gap-4">
                      {COLOR_OPTIONS.map((color) => (
                        <label key={color} className="flex items-center gap-2 text-sm text-slate-100">
                          <input
                            type="checkbox"
                            checked={editColors.includes(color)}
                            onChange={() => toggleEditColor(color)}
                          />
                          {color}
                        </label>
                      ))}
                    </div>
                    {editFieldErrors.colors && (
                      <p className="mt-2 text-xs text-rose-300">{editFieldErrors.colors}</p>
                    )}
                  </fieldset>

                  <fieldset className="rounded-xl border border-white/10 p-3 md:col-span-2">
                    <legend className="px-2 text-sm text-white">Listing Photos</legend>
                    <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {Array.from({ length: 4 }).map((_, index) => {
                        const src = editListingPhotoUrls[index] || '';
                        return (
                          <div
                            key={`listing-photo-slot-${index}`}
                            className="aspect-square overflow-hidden rounded-lg border border-white/15 bg-black/20"
                          >
                            {src ? (
                              <img
                                src={src}
                                alt={`Listing photo ${index + 1}`}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-[10px] uppercase tracking-[0.14em] text-slate-400">
                                Empty
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <label className="mt-3 block text-sm text-white">
                      Update listing photos (replace all 4)
                      <input
                        data-testid="admin-edit-product-photos"
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={(event) => {
                          const files = Array.from(event.target.files || []);
                          setEditReplacementPhotos(files);
                          setEditFieldErrors((prev) => ({
                            ...prev,
                            listing_photos:
                              files.length === 0 || files.length === 4
                                ? ''
                                : 'Exactly 4 listing photos are required when replacing',
                          }));
                        }}
                        className="mt-2 block w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-sm text-white"
                      />
                    </label>
                    <p className="mt-1 text-xs text-slate-300">
                      {editReplacementPhotos.length > 0
                        ? `${editReplacementPhotos.length} selected (replacement set)`
                        : 'No new photos selected. Existing photos will be kept.'}
                    </p>
                    {editFieldErrors.listing_photos && (
                      <p className="mt-1 text-xs text-rose-300">{editFieldErrors.listing_photos}</p>
                    )}
                  </fieldset>
                </div>

                <div className="flex gap-2">
                  <button
                    data-testid="admin-edit-product-save"
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
              </>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
