import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiFetch, apiFetchForm } from '../../../shared/api/http';

type Artist = {
  id: string;
  handle?: string;
  name?: string;
};

type InventorySku = {
  id: string;
  supplierSku: string;
  supplier_sku?: string;
  merchType: string;
  merch_type?: string;
  qualityTier: string | null;
  quality_tier?: string | null;
  size: string;
  color: string;
  stock: number;
  isActive: boolean;
  is_active?: boolean;
  mrpCents: number | null;
  mrp_cents?: number | null;
};

type FieldErrors = Record<string, string>;

const MAX_LISTING_PHOTOS = 4;
const LISTING_PHOTO_ACCEPT = 'image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp';

const asText = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const asNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const asBoolean = (value: unknown): boolean => {
  if (typeof value === 'boolean') return value;
  if (value === 'true' || value === '1' || value === 1) return true;
  if (value === 'false' || value === '0' || value === 0) return false;
  return false;
};

const normalizeSku = (row: any): InventorySku => ({
  id: String(row?.id || ''),
  supplierSku: asText(row?.supplierSku || row?.supplier_sku),
  supplier_sku: asText(row?.supplier_sku || row?.supplierSku),
  merchType: asText(row?.merchType || row?.merch_type),
  merch_type: asText(row?.merch_type || row?.merchType),
  qualityTier: asText(row?.qualityTier || row?.quality_tier) || null,
  quality_tier: asText(row?.quality_tier || row?.qualityTier) || null,
  size: asText(row?.size),
  color: asText(row?.color),
  stock: Number(row?.stock ?? 0),
  isActive: asBoolean(row?.isActive ?? row?.is_active),
  is_active: asBoolean(row?.is_active ?? row?.isActive),
  mrpCents:
    row?.mrpCents === 0 || row?.mrp_cents === 0 || row?.mrpCents != null || row?.mrp_cents != null
      ? Number(row?.mrpCents ?? row?.mrp_cents ?? 0)
      : null,
  mrp_cents:
    row?.mrp_cents === 0 || row?.mrpCents === 0 || row?.mrp_cents != null || row?.mrpCents != null
      ? Number(row?.mrp_cents ?? row?.mrpCents ?? 0)
      : null,
});

const mapValidationDetails = (details: any[]): FieldErrors => {
  const out: FieldErrors = {};
  details.forEach((detail) => {
    const field = asText(detail?.field);
    const message = asText(detail?.message);
    if (!field || !message) return;
    if (!out[field]) out[field] = message;
  });
  return out;
};

const formatSkuLabel = (sku: InventorySku): string => {
  const quality = asText(sku.qualityTier || sku.quality_tier);
  const qualityPart = quality ? ` - ${quality}` : '';
  return `${sku.supplierSku} - ${sku.merchType}${qualityPart} - ${sku.color} - ${sku.size} - Stock: ${sku.stock}${sku.isActive ? '' : ' - Inactive'}`;
};

const buildVariantSku = (sku: InventorySku): string => {
  const source = asText(sku.supplierSku || sku.supplier_sku);
  if (source) return `SKU-${source}`.slice(0, 120);
  return `SKU-${sku.id.slice(0, 8) || 'NEW'}`;
};

const resolveSkuPriceCents = (sku: InventorySku): number => {
  const value = Number(sku.mrpCents ?? sku.mrp_cents ?? 0);
  if (!Number.isInteger(value) || value <= 0) return 0;
  return value;
};

const resolveCreatePriceCents = (skus: InventorySku[]): number => {
  const firstPositive = skus
    .map((sku) => resolveSkuPriceCents(sku))
    .find((value) => Number.isInteger(value) && value > 0);
  return typeof firstPositive === 'number' ? firstPositive : 1;
};

const mapCreateErrorMessage = (error: any, stage: 'create' | 'link' | 'photos', productId: string | null): string => {
  const raw = asText(error?.message).toLowerCase();

  if (raw.includes('invalid_inventory_sku_id') || raw.includes('inventory_sku_not_found')) {
    return 'This product could not be linked to the selected SKU.';
  }
  if (raw.includes('duplicate_inventory_sku_mapping')) {
    return 'This SKU is already linked to the product.';
  }
  if (raw.includes('validation')) {
    return 'Please review the highlighted fields and try again.';
  }
  if (raw.includes('failed to fetch')) {
    return "We couldn't reach the server. Please check your connection and try again.";
  }

  if (productId && stage === 'link') {
    return 'Product created, but linking selected SKUs failed. Open product variants and link them manually.';
  }
  if (productId && stage === 'photos') {
    return 'Product and SKU links were saved, but listing photo upload failed.';
  }

  return "We couldn't create the product right now. Please try again.";
};

const isDuplicateMappingError = (error: any): boolean => {
  const raw = asText(error?.message).toLowerCase();
  const status = Number(error?.status || 0);
  return status === 409 || raw.includes('duplicate_inventory_sku_mapping');
};

export default function AdminCreateProductPage() {
  const navigate = useNavigate();
  const [artists, setArtists] = useState<Artist[]>([]);
  const [inventorySkus, setInventorySkus] = useState<InventorySku[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [artistId, setArtistId] = useState('');
  const [merchName, setMerchName] = useState('');
  const [merchStory, setMerchStory] = useState('');
  const [listingPhotos, setListingPhotos] = useState<File[]>([]);

  const [skuSearch, setSkuSearch] = useState('');
  const [skuToAddId, setSkuToAddId] = useState('');
  const [selectedSkuIds, setSelectedSkuIds] = useState<string[]>([]);

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [skuLoadError, setSkuLoadError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setSubmitError(null);
      setSkuLoadError(null);
      try {
        const [artistsResult, skusResult] = await Promise.allSettled([
          apiFetch('/artists'),
          apiFetch('/admin/inventory-skus'),
        ]);

        if (!active) return;

        if (artistsResult.status === 'fulfilled') {
          const artistItems = Array.isArray(artistsResult.value?.artists)
            ? artistsResult.value.artists
            : Array.isArray(artistsResult.value)
              ? artistsResult.value
              : [];
          setArtists(artistItems);
          if (artistItems.length > 0) {
            setArtistId(String(artistItems[0].id || ''));
          }
        } else {
          setSubmitError('Failed to load artists.');
        }

        if (skusResult.status === 'fulfilled') {
          const skuItems = Array.isArray(skusResult.value?.items)
            ? skusResult.value.items
            : Array.isArray(skusResult.value)
              ? skusResult.value
              : [];
          setInventorySkus(skuItems.map(normalizeSku).filter((sku) => Boolean(sku.id)));
        } else {
          setSkuLoadError("We couldn't load supplier SKUs.");
        }
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const artistOptions = useMemo(
    () =>
      artists.map((artist) => ({
        id: artist.id,
        label: artist.name || artist.handle || artist.id,
      })),
    [artists]
  );

  const skuById = useMemo(() => {
    const map = new Map<string, InventorySku>();
    inventorySkus.forEach((sku) => map.set(sku.id, sku));
    return map;
  }, [inventorySkus]);

  const selectedSkus = useMemo(
    () =>
      selectedSkuIds
        .map((id) => skuById.get(id))
        .filter((sku): sku is InventorySku => Boolean(sku)),
    [selectedSkuIds, skuById]
  );

  const availableSkus = useMemo(() => {
    const q = asText(skuSearch).toLowerCase();
    return inventorySkus.filter((sku) => {
      if (selectedSkuIds.includes(sku.id)) return false;
      if (!q) return true;
      const haystack = [
        sku.supplierSku,
        sku.merchType,
        sku.qualityTier || '',
        sku.color,
        sku.size,
        `${sku.stock}`,
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [inventorySkus, selectedSkuIds, skuSearch]);

  useEffect(() => {
    if (skuToAddId && availableSkus.some((sku) => sku.id === skuToAddId)) return;
    setSkuToAddId(availableSkus[0]?.id || '');
  }, [availableSkus, skuToAddId]);

  const addSelectedSku = () => {
    if (!skuToAddId) return;
    setSelectedSkuIds((prev) => (prev.includes(skuToAddId) ? prev : [...prev, skuToAddId]));
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next.selected_skus;
      return next;
    });
  };

  const removeSelectedSku = (id: string) => {
    setSelectedSkuIds((prev) => prev.filter((entry) => entry !== id));
  };

  const validate = (): FieldErrors => {
    const errors: FieldErrors = {};
    if (!artistId) errors.artist_id = 'Artist is required.';
    if (merchName.trim().length < 2) errors.merch_name = 'Merch Name must be at least 2 characters.';
    if (merchStory.trim().length < 10) errors.merch_story = 'Merch Story must be at least 10 characters.';
    if (selectedSkuIds.length < 1) errors.selected_skus = 'Select at least one SKU.';
    if (listingPhotos.length !== MAX_LISTING_PHOTOS) {
      errors.listing_photos = 'Exactly 4 listing photos are required.';
    }
    return errors;
  };

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitError(null);

    const validationErrors = validate();
    setFieldErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      setSubmitError('Please fix the highlighted fields.');
      return;
    }
    const dedupedSelectedSkus = Array.from(
      new Map(selectedSkus.map((sku) => [sku.id, sku])).values()
    );

    if (dedupedSelectedSkus.length < 1) {
      setFieldErrors((prev) => ({ ...prev, selected_skus: 'Select at least one SKU.' }));
      setSubmitError('Please fix the highlighted fields.');
      return;
    }

    let stage: 'create' | 'link' | 'photos' = 'create';
    let createdProductId: string | null = null;

    setSubmitting(true);
    try {
      const createPayload = await apiFetch('/admin/products', {
        method: 'POST',
        body: {
          artistId,
          title: merchName.trim(),
          description: merchStory.trim(),
          isActive: false,
          status: 'inactive',
          priceCents: resolveCreatePriceCents(dedupedSelectedSkus),
          // Product record creation stays backward-compatible; sellability is variant/SKU-based.
          stock: 0,
        },
      });

      createdProductId = asText(
        createPayload?.productId || createPayload?.product_id || createPayload?.product?.id || createPayload?.id
      );
      if (!createdProductId) {
        throw new Error('missing_product_id');
      }

      let defaultVariantId = asText(createPayload?.defaultVariant?.id);
      if (!defaultVariantId) {
        const variantsPayload = await apiFetch(`/admin/products/${createdProductId}/variants`);
        const rows = Array.isArray(variantsPayload?.items)
          ? variantsPayload.items
          : Array.isArray(variantsPayload?.variants)
            ? variantsPayload.variants
            : [];
        defaultVariantId = asText(rows[0]?.id);
      }

      stage = 'link';
      const variantsBody = {
        variants: dedupedSelectedSkus.map((sku, index) => {
          const sellingPriceCents = resolveSkuPriceCents(sku);
          const isListed = sellingPriceCents > 0 && sku.isActive && sku.stock > 0;
          return {
            id: index === 0 && defaultVariantId ? defaultVariantId : undefined,
            inventory_sku_id: sku.id,
            sku: buildVariantSku(sku),
            size: asText(sku.size) || 'default',
            color: asText(sku.color) || 'default',
            selling_price_cents: sellingPriceCents,
            is_listed: isListed,
          };
        }),
      };

      try {
        await apiFetch(`/admin/products/${createdProductId}/variants`, {
          method: 'PUT',
          body: variantsBody,
        });
      } catch (err: any) {
        if (!isDuplicateMappingError(err)) {
          throw err;
        }

        // Duplicate mapping can happen if a link already exists; reconcile against current state.
        const variantsPayload = await apiFetch(`/admin/products/${createdProductId}/variants`, {
          cache: 'no-store',
        });
        const rows = Array.isArray(variantsPayload?.items)
          ? variantsPayload.items
          : Array.isArray(variantsPayload?.variants)
            ? variantsPayload.variants
            : [];
        const mappedSkuIds = new Set(
          rows
            .map((row: any) => asText(row?.inventory_sku_id || row?.inventorySkuId))
            .filter(Boolean)
        );
        const allRequestedMappingsPresent = dedupedSelectedSkus.every((sku) => mappedSkuIds.has(sku.id));
        if (!allRequestedMappingsPresent) {
          throw err;
        }
      }

      stage = 'photos';
      const listingPhotoForm = new FormData();
      listingPhotos.forEach((file) => {
        listingPhotoForm.append('photos', file);
      });
      await apiFetchForm(`/admin/products/${createdProductId}/photos`, listingPhotoForm, {
        method: 'PUT',
      });

      navigate('/partner/admin/products');
    } catch (err: any) {
      const details = Array.isArray(err?.details) ? err.details : [];
      if (details.length > 0) {
        const mapped = mapValidationDetails(details);
        setFieldErrors((prev) => ({ ...prev, ...mapped }));
      }
      setSubmitError(mapCreateErrorMessage(err, stage, createdProductId));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 dark:text-slate-500">Admin Control</p>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white">Create Product</h1>
        </div>
        <Link className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-white transition-all border border-slate-200 dark:border-white/10 px-4 py-1.5 rounded-full" to="/partner/admin/products">
          Back to items
        </Link>
      </div>

      {submitError && (
        <div role="alert" className="rounded-xl border border-rose-200 dark:border-rose-400/40 bg-rose-50 dark:bg-rose-500/10 px-4 py-3 text-sm font-bold text-rose-600 dark:text-rose-400">
          {submitError}
        </div>
      )}

      <form
        onSubmit={onSubmit}
        className="grid gap-6 rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 p-8 md:grid-cols-2 shadow-sm"
      >
        <label htmlFor="admin-product-artist" className="block space-y-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Artist</span>
          <select
            id="admin-product-artist"
            data-testid="admin-product-artist"
            value={artistId}
            onChange={(event) => setArtistId(event.target.value)}
            disabled={loading || submitting}
            className="w-full rounded-xl border border-slate-200 dark:border-white/15 bg-white dark:bg-black/30 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-indigo-500 dark:focus:border-white/40 transition outline-none appearance-none"
          >
            <option value="" className="bg-white dark:bg-slate-900">Select artist</option>
            {artistOptions.map((artist) => (
              <option key={artist.id} value={artist.id} className="bg-white dark:bg-slate-900">
                {artist.label}
              </option>
            ))}
          </select>
          {fieldErrors.artist_id && <p className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-tight">{fieldErrors.artist_id}</p>}
        </label>

        <label className="block space-y-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Merch Name</span>
          <input
            data-testid="admin-product-merch-name"
            value={merchName}
            onChange={(event) => setMerchName(event.target.value)}
            disabled={submitting}
            placeholder="e.g. Vintage Rock Tee"
            className="w-full rounded-xl border border-slate-200 dark:border-white/15 bg-white dark:bg-black/30 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-indigo-500 dark:focus:border-white/40 transition outline-none"
          />
          {fieldErrors.merch_name && <p className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-tight">{fieldErrors.merch_name}</p>}
        </label>

        <label className="block space-y-2 md:col-span-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Merch Story</span>
          <textarea
            data-testid="admin-product-merch-story"
            value={merchStory}
            onChange={(event) => setMerchStory(event.target.value)}
            rows={4}
            disabled={submitting}
            placeholder="Describe the product and its backstory..."
            className="w-full rounded-xl border border-slate-200 dark:border-white/15 bg-white dark:bg-black/30 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-indigo-500 dark:focus:border-white/40 transition outline-none"
          />
          {fieldErrors.merch_story && <p className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-tight">{fieldErrors.merch_story}</p>}
        </label>

        <label className="block space-y-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Initial Status</span>
          <input
            value="Inactive"
            readOnly
            disabled
            className="w-full rounded-xl border border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-black/60 px-3 py-2 text-sm font-black uppercase tracking-widest text-slate-400 dark:text-slate-600 cursor-not-allowed"
          />
        </label>

        <div className="rounded-2xl border border-slate-200 dark:border-white/10 p-5 bg-slate-50/30 dark:bg-transparent">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">SKU Selection</p>
          <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
            Select one or more supplier SKUs to link during product creation.
          </p>
        </div>

        <fieldset className="rounded-2xl border border-slate-200 dark:border-white/10 p-5 md:col-span-2 bg-slate-50/30 dark:bg-transparent">
          <legend className="px-3 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Supplier SKUs</legend>

          <div className="grid gap-3 md:grid-cols-[1fr,1fr,auto]">
            <label className="block space-y-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Search SKUs</span>
              <input
                data-testid="admin-product-sku-search"
                value={skuSearch}
                onChange={(event) => setSkuSearch(event.target.value)}
                disabled={loading || submitting || Boolean(skuLoadError)}
                placeholder="Filter by supplier SKU / merch / color / size"
                className="w-full rounded-xl border border-slate-200 dark:border-white/15 bg-white dark:bg-black/30 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-indigo-500 dark:focus:border-white/40 transition outline-none"
              />
            </label>

            <label className="block space-y-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Select SKU</span>
              <select
                data-testid="admin-product-sku-select"
                value={skuToAddId}
                onChange={(event) => setSkuToAddId(event.target.value)}
                disabled={loading || submitting || availableSkus.length === 0 || Boolean(skuLoadError)}
                className="w-full rounded-xl border border-slate-200 dark:border-white/15 bg-white dark:bg-black/30 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-indigo-500 dark:focus:border-white/40 transition outline-none appearance-none"
              >
                <option value="" className="bg-white dark:bg-slate-900">
                  {loading ? 'Loading SKUs...' : availableSkus.length > 0 ? 'Select supplier SKU' : 'No SKUs available'}
                </option>
                {availableSkus.map((sku) => (
                  <option key={sku.id} value={sku.id} className="bg-white dark:bg-slate-900">
                    {formatSkuLabel(sku)}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              data-testid="admin-product-sku-add"
              onClick={addSelectedSku}
              disabled={submitting || !skuToAddId || Boolean(skuLoadError)}
              className="self-end rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-200 disabled:opacity-50"
            >
              Add SKU
            </button>
          </div>

          {skuLoadError && (
            <p className="mt-4 text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-tight">{skuLoadError}</p>
          )}

          {!loading && !skuLoadError && inventorySkus.length === 0 && (
            <p data-testid="admin-product-sku-empty-state" className="mt-4 text-[11px] text-slate-500 dark:text-slate-400">
              No supplier SKUs available yet. Create SKUs first in the SKU manager.
            </p>
          )}

          {!loading && !skuLoadError && inventorySkus.length > 0 && selectedSkus.length === 0 && (
            <p className={`mt-4 text-[10px] font-bold uppercase tracking-tight ${fieldErrors.selected_skus ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500 dark:text-slate-400'}`}>
              {fieldErrors.selected_skus || 'Select at least one SKU.'}
            </p>
          )}

          {selectedSkus.length > 0 && (
            <div className="mt-4 space-y-2">
              {selectedSkus.map((sku) => (
                <div
                  key={sku.id}
                  data-testid="admin-product-selected-sku"
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-black/30 px-3 py-2"
                >
                  <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                    {formatSkuLabel(sku)}
                  </p>
                  <button
                    type="button"
                    data-testid={`admin-product-selected-sku-remove-${sku.id}`}
                    onClick={() => removeSelectedSku(sku.id)}
                    disabled={submitting}
                    className="rounded-full border border-slate-200 dark:border-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-300"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </fieldset>

        <label className="block space-y-2 md:col-span-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Listing Photos (exactly 4)</span>
          <div className="relative group">
            <input
              data-testid="admin-product-listing-photos"
              type="file"
              accept={LISTING_PHOTO_ACCEPT}
              multiple
              onChange={(event) => {
                const files = Array.from(event.target.files || []);
                setListingPhotos(files);
                setFieldErrors((prev) => ({
                  ...prev,
                  listing_photos: files.length === MAX_LISTING_PHOTOS ? '' : 'Exactly 4 listing photos are required',
                  photos: files.length === MAX_LISTING_PHOTOS ? '' : 'Exactly 4 listing photos are required',
                }));
              }}
              disabled={submitting}
              className="w-full rounded-xl border border-dashed border-slate-200 dark:border-white/20 bg-slate-50 dark:bg-black/30 px-3 py-8 text-sm text-slate-500 dark:text-slate-400 focus:border-indigo-500 dark:focus:border-white/40 transition outline-none cursor-pointer text-center file:hidden"
            />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 group-hover:text-indigo-500 transition-colors">
                {listingPhotos.length > 0 ? `${listingPhotos.length} / 4 Photos Selected` : 'Click to upload 4 photos'}
              </span>
            </div>
          </div>
          {(fieldErrors.listing_photos || fieldErrors.photos) && (
            <p className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-tight">{fieldErrors.listing_photos || fieldErrors.photos}</p>
          )}
        </label>

        <div className="flex flex-wrap items-center justify-between gap-4 md:col-span-2 pt-6 border-t border-slate-100 dark:border-white/5">
          <button
            data-testid="admin-product-submit"
            type="submit"
            disabled={submitting || loading || listingPhotos.length !== MAX_LISTING_PHOTOS || Boolean(skuLoadError)}
            className="rounded-full bg-slate-900 dark:bg-white px-10 py-3 text-xs font-black uppercase tracking-widest text-white dark:text-slate-950 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-slate-900/10 dark:shadow-none"
          >
            {submitting ? 'Creating...' : 'Create Product'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/partner/admin/products')}
            className="rounded-full border border-slate-200 dark:border-white/10 bg-white dark:bg-transparent px-10 py-3 text-xs font-black uppercase tracking-widest text-slate-500 dark:text-white hover:bg-slate-50 dark:hover:bg-white/5 transition-all"
          >
            Discard
          </button>
        </div>
      </form>
    </main>
  );
}
