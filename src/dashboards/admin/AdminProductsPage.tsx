import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiFetch, apiFetchForm } from '../../shared/api/http';
import { resolveMediaUrl } from '../../shared/utils/media';

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
    .map((entry) => resolveMediaUrl(typeof entry === 'string' ? entry : null))
    .filter((entry): entry is string => Boolean(entry));
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
        body: JSON.stringify({
          title: editTitle.trim(),
          description: editDescription.trim(),
          merch_story: editDescription.trim(),
          vendor_pay: editVendorPay.trim(),
          our_share: editOurShare.trim(),
          royalty: editRoyalty.trim(),
          merch_type: editMerchType.trim(),
          colors: editColors,
          isActive: editActive,
        }),
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
          ? photoUpdate.listingPhotoUrls
            .map((entry: any) => resolveMediaUrl(typeof entry === 'string' ? entry : null))
            .filter((entry: string | null): entry is string => Boolean(entry))
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
    <main className="space-y-8 min-h-screen pb-20">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-slate-100 dark:border-white/5">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-600 dark:text-indigo-400">Inventory Management</p>
          </div>
          <h1 className="text-4xl font-black tracking-tight text-slate-900 dark:text-white">Products</h1>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <Link
            to="/partner/admin/products/new"
            className="group relative inline-flex items-center justify-center rounded-2xl bg-slate-900 dark:bg-white px-8 py-4 text-xs font-black uppercase tracking-[0.2em] text-white dark:text-slate-950 shadow-2xl shadow-slate-900/20 dark:shadow-white/10 transition-all hover:scale-[1.02] active:scale-95 overflow-hidden"
          >
            <span className="relative z-10 flex items-center gap-2">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" />
              </svg>
              Create Product
            </span>
          </Link>
          <Link
            className="group flex items-center gap-2 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-6 py-4 text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:border-slate-900 dark:hover:border-white/20 transition-all shadow-sm"
            to="/partner/admin"
          >
            <svg className="h-4 w-4 transition-transform group-hover:-translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Dashboard
          </Link>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl bg-rose-50 dark:bg-rose-500/10 p-4 border border-rose-100 dark:border-rose-500/20">
          <p className="text-sm font-bold text-rose-600 dark:text-rose-400 flex items-center gap-2">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error}
          </p>
        </div>
      )}

      {/* Table Section */}
      <div className="overflow-hidden rounded-[2rem] border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 shadow-2xl shadow-slate-200/50 dark:shadow-none">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-black/20 text-left text-[10px] font-black uppercase tracking-[0.25em] text-slate-400 dark:text-slate-500">
              <th className="px-8 py-5">Product Info</th>
              <th className="px-8 py-5">Artist</th>
              <th className="px-8 py-5">Performance</th>
              <th className="px-8 py-5">Status</th>
              <th className="px-8 py-5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {!loading && products.length === 0 && (
              <tr>
                <td colSpan={5} className="px-8 py-12 text-center">
                  <div className="flex flex-col items-center gap-2 text-slate-400">
                    <svg className="h-12 w-12 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4a2 2 0 012-2m16 0h-4m-8 0H4" />
                    </svg>
                    <p className="text-sm font-bold uppercase tracking-widest">No products found</p>
                  </div>
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
              const thumbnail = extractListingPhotoUrls(product)[0] || '';

              return (
                <tr key={product.id} className="group border-b border-slate-50 dark:border-white/5 hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors">
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-4">
                      {thumbnail ? (
                        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-slate-200 dark:border-white/10 shadow-sm transition-transform group-hover:scale-105">
                          <img
                            src={thumbnail}
                            alt={product.title ?? 'Product'}
                            className="h-full w-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-white/5 text-slate-400">
                          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                      )}
                      <div>
                        <p className="font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                          {product.title ?? 'Untitled Product'}
                        </p>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">ID: {product.id.slice(0, 8)}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                      {artistLabelById[artistId] || 'Unknown Artist'}
                    </span>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-slate-900 dark:text-white uppercase">{(product.merchType || 'Other').replace('_', ' ')}</span>
                      <span className="text-[10px] text-slate-400 uppercase tracking-tighter">Category</span>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest ring-1 ring-inset ${active
                        ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-emerald-500/20'
                        : 'bg-slate-50 dark:bg-white/5 text-slate-400 dark:text-slate-500 ring-slate-200 dark:ring-white/10'
                      }`}>
                      {statusLabel}
                    </span>
                  </td>
                  <td className="px-8 py-5 text-right">
                    <div className="flex justify-end items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openEditModal(product)}
                        className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300 hover:bg-slate-900 dark:hover:bg-white hover:text-white dark:hover:text-slate-950 transition-all shadow-sm"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => navigate(`/partner/admin/products/${product.id}/variants`)}
                        className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300 hover:bg-slate-900 dark:hover:bg-white hover:text-white dark:hover:text-slate-950 transition-all shadow-sm"
                      >
                        Variants
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Edit Modal */}
      {isEditOpen && editingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[2.5rem] border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950 shadow-2xl animate-in zoom-in-95 duration-300 custom-scrollbar flex flex-col">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 dark:border-white/10 bg-white/90 dark:bg-slate-950/90 px-8 py-6 backdrop-blur-sm">
              <div>
                <h2 className="text-2xl font-black text-slate-900 dark:text-white">Edit Product</h2>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Settings & Details</p>
              </div>
              <button
                type="button"
                onClick={closeEditModal}
                className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white transition shadow-sm"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-8 space-y-8 flex-1">
              {editError && (
                <div className="rounded-2xl bg-rose-50 dark:bg-rose-500/10 p-4 border border-rose-100 dark:border-rose-500/20">
                  <p className="text-xs font-bold text-rose-600 dark:text-rose-400 uppercase tracking-widest">{editError}</p>
                </div>
              )}

              {editLoading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent"></div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Fetching Matrix...</p>
                </div>
              ) : (
                <>
                  <div className="grid gap-6 md:grid-cols-2">
                    <label className="block space-y-2">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Artist</span>
                      <input
                        data-testid="admin-edit-product-artist"
                        value={artistLabelById[editArtistId] || editArtistId || '-'}
                        readOnly
                        disabled
                        className="block w-full rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/40 px-5 py-3 text-sm font-medium text-slate-400 dark:text-white/40 cursor-not-allowed uppercase tracking-widest shadow-inner"
                      />
                    </label>

                    <label className="block space-y-2">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Merch Name *</span>
                      <input
                        data-testid="admin-edit-product-merch-name"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="block w-full rounded-2xl border border-slate-200 dark:border-white/15 bg-white dark:bg-black/20 px-5 py-3 text-sm font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 outline-none transition shadow-inner"
                      />
                      {editFieldErrors.title && <p className="text-[10px] text-rose-500 font-bold uppercase">{editFieldErrors.title}</p>}
                    </label>

                    <label className="block space-y-2 md:col-span-2">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Description *</span>
                      <textarea
                        data-testid="admin-edit-product-story"
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        rows={4}
                        className="block w-full rounded-2xl border border-slate-200 dark:border-white/15 bg-white dark:bg-black/20 px-5 py-4 text-sm leading-relaxed text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 outline-none transition shadow-inner"
                      />
                      {editFieldErrors.merch_story && <p className="text-[10px] text-rose-500 font-bold uppercase">{editFieldErrors.merch_story}</p>}
                    </label>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:col-span-2">
                      <label className="block space-y-2">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Vendor Pay (₹)</span>
                        <input
                          type="number"
                          value={editVendorPay}
                          onChange={(e) => setEditVendorPay(e.target.value)}
                          className="block w-full rounded-2xl border border-slate-200 dark:border-white/15 bg-white dark:bg-black/20 px-5 py-3 text-sm font-bold text-slate-900 dark:text-white outline-none"
                        />
                      </label>
                      <label className="block space-y-2">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Internal (₹)</span>
                        <input
                          type="number"
                          value={editOurShare}
                          onChange={(e) => setEditOurShare(e.target.value)}
                          className="block w-full rounded-2xl border border-slate-200 dark:border-white/15 bg-white dark:bg-black/20 px-5 py-3 text-sm font-bold text-slate-900 dark:text-white outline-none"
                        />
                      </label>
                      <label className="block space-y-2">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Royalty (₹)</span>
                        <input
                          type="number"
                          value={editRoyalty}
                          onChange={(e) => setEditRoyalty(e.target.value)}
                          className="block w-full rounded-2xl border border-slate-200 dark:border-white/15 bg-white dark:bg-black/20 px-5 py-3 text-sm font-bold text-slate-900 dark:text-white outline-none"
                        />
                      </label>
                    </div>

                    <label className="block space-y-2">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Category</span>
                      <select
                        value={editMerchType}
                        onChange={(e) => setEditMerchType(e.target.value)}
                        className="block w-full rounded-2xl border border-slate-200 dark:border-white/15 bg-white dark:bg-black/40 px-5 py-3 text-sm font-bold text-slate-900 dark:text-white outline-none appearance-none"
                      >
                        {MERCH_TYPE_OPTIONS.map(opt => <option key={opt} value={opt} className="bg-white dark:bg-slate-900">{opt.toUpperCase()}</option>)}
                      </select>
                    </label>

                    <div className="flex items-center gap-6">
                      <label className="relative flex cursor-pointer items-center gap-3">
                        <div className="relative">
                          <input type="checkbox" checked={editActive} onChange={(e) => setEditActive(e.target.checked)} className="peer sr-only" />
                          <div className="h-6 w-11 rounded-full bg-slate-200 dark:bg-white/10 peer-checked:bg-emerald-500 transition-colors"></div>
                          <div className="absolute left-1 top-1 h-4 w-4 rounded-full bg-white transition-transform peer-checked:translate-x-5"></div>
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Active Status</span>
                      </label>
                    </div>
                  </div>

                  <fieldset className="rounded-3xl border border-slate-200 dark:border-white/10 p-6 bg-slate-50/50 dark:bg-black/20">
                    <legend className="px-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Color Options</legend>
                    <div className="flex flex-wrap gap-6">
                      {COLOR_OPTIONS.map(color => (
                        <label key={color} className="flex items-center gap-2 cursor-pointer group">
                          <input type="checkbox" checked={editColors.includes(color)} onChange={() => toggleEditColor(color)} className="h-4 w-4 rounded border-slate-300 text-indigo-600" />
                          <span className="text-xs font-bold uppercase tracking-widest text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
                            {color.replace('_', ' ')}
                          </span>
                        </label>
                      ))}
                    </div>
                  </fieldset>

                  <fieldset className="rounded-3xl border border-slate-200 dark:border-white/10 p-6 bg-slate-50/50 dark:bg-black/20">
                    <legend className="px-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Visual Assets (4 Required)</legend>
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                      {Array.from({ length: 4 }).map((_, idx) => {
                        const src = editListingPhotoUrls[idx];
                        return (
                          <div key={idx} className="aspect-square rounded-2xl border-2 border-slate-200 dark:border-white/10 bg-white dark:bg-black/40 overflow-hidden">
                            {src ? <img src={src} className="h-full w-full object-cover" /> : <div className="h-full w-full flex items-center justify-center text-[10px] text-slate-300 font-black">SLOT {idx + 1}</div>}
                          </div>
                        );
                      })}
                    </div>
                    <label className="mt-8 group relative flex flex-col items-center justify-center rounded-[2rem] border-2 border-dashed border-slate-300 dark:border-white/10 py-10 hover:border-indigo-500 cursor-pointer transition-all">
                      <div className="text-center space-y-2">
                        <p className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest">Replace All Photos</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase">PNG / JPG / WEBP</p>
                      </div>
                      <input type="file" multiple accept="image/*" className="sr-only" onChange={(e) => setEditReplacementPhotos(Array.from(e.target.files || []))} />
                    </label>
                  </fieldset>
                </>
              )}
            </div>

            <div className="sticky bottom-0 bg-white/90 dark:bg-slate-950/90 border-t border-slate-100 dark:border-white/10 p-8 flex gap-4 backdrop-blur-sm">
              <button
                data-testid="admin-edit-product-save"
                type="button"
                onClick={saveEdit}
                disabled={saving}
                className="flex-1 rounded-[1.25rem] bg-slate-900 dark:bg-white py-4 text-[10px] font-black uppercase tracking-[0.3em] text-white dark:text-slate-950 shadow-2xl transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:scale-100"
              >
                {saving ? 'Synchronizing...' : 'Commit Changes'}
              </button>
              <button
                type="button"
                onClick={closeEditModal}
                className="rounded-[1.25rem] border-2 border-slate-200 dark:border-white/10 bg-white dark:bg-transparent px-8 py-4 text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white hover:border-slate-900 dark:hover:border-white/20 transition-all"
              >
                Discard
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
