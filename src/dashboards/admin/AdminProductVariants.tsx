import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { apiFetch } from '../../shared/api/http';

type InventorySku = {
  id: string;
  supplierSku: string;
  merchType: string;
  qualityTier: string | null;
  size: string;
  color: string;
  stock: number;
  isActive: boolean;
};

type VariantRow = {
  id?: string;
  sku: string;
  inventorySkuId: string;
  isListed: boolean;
  sellingPriceCents: string;
  vendorPayoutCents: string;
  royaltyCents: string;
  ourShareCents: string;
  size: string;
  color: string;
  skuIsActive: boolean;
  stock: number;
  effectiveSellable: boolean;
};

type FieldErrors = Record<string, string>;

const asText = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');
const asNumberText = (value: unknown): string => {
  if (value === null || value === undefined || value === '') return '';
  const n = Number(value);
  return Number.isFinite(n) ? `${n}` : '';
};
const asNumber = (value: unknown, fallback = 0): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};
const asBoolean = (value: unknown, fallback = false): boolean => {
  if (typeof value === 'boolean') return value;
  if (value === 'true' || value === '1' || value === 1) return true;
  if (value === 'false' || value === '0' || value === 0) return false;
  return fallback;
};

const nonNegativeInteger = (value: string): number | null => {
  const trimmed = asText(value);
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0 || !Number.isInteger(parsed)) return null;
  return parsed;
};

const normalizeSku = (row: any): InventorySku => ({
  id: String(row?.id || ''),
  supplierSku: asText(row?.supplierSku || row?.supplier_sku),
  merchType: asText(row?.merchType || row?.merch_type),
  qualityTier: asText(row?.qualityTier || row?.quality_tier) || null,
  size: asText(row?.size),
  color: asText(row?.color),
  stock: asNumber(row?.stock, 0),
  isActive: asBoolean(row?.isActive ?? row?.is_active, false),
});

const normalizeVariant = (row: any): VariantRow => ({
  id: asText(row?.id) || undefined,
  sku: asText(row?.sku),
  inventorySkuId: asText(row?.inventorySkuId || row?.inventory_sku_id),
  isListed: asBoolean(row?.variantIsListed ?? row?.variant_is_listed ?? row?.is_listed, true),
  sellingPriceCents: asNumberText(row?.sellingPriceCents ?? row?.selling_price_cents ?? row?.priceCents ?? row?.price_cents),
  vendorPayoutCents: asNumberText(row?.vendorPayoutCents ?? row?.vendor_payout_cents),
  royaltyCents: asNumberText(row?.royaltyCents ?? row?.royalty_cents),
  ourShareCents: asNumberText(row?.ourShareCents ?? row?.our_share_cents),
  size: asText(row?.size),
  color: asText(row?.color),
  skuIsActive: asBoolean(row?.skuIsActive ?? row?.sku_is_active, false),
  stock: asNumber(row?.stock, 0),
  effectiveSellable: asBoolean(row?.effectiveSellable ?? row?.effective_sellable, false),
});

const formatVariantError = (error: any): string => {
  const raw = asText(error?.message).toLowerCase();
  if (raw.includes('duplicate_inventory_sku_mapping')) {
    return 'This SKU is already linked to the product.';
  }
  if (raw.includes('invalid_inventory_sku_id') || raw.includes('inventory_sku_not_found')) {
    return 'Please select a supplier SKU.';
  }
  if (raw.includes('invalid_price')) return 'Selling price must be a non-negative integer.';
  if (raw.includes('invalid_vendor_payout_cents')) return 'Vendor payout must be a non-negative integer.';
  if (raw.includes('invalid_royalty_cents')) return 'Royalty must be a non-negative integer.';
  if (raw.includes('invalid_our_share_cents')) return 'Our share must be a non-negative integer.';
  if (raw.includes('no_fields')) return 'No changes to save yet.';
  if (raw.includes('failed to fetch')) return 'Network error. Please try again.';
  return "We couldn't save variants right now. Please try again.";
};

const createNewVariantRow = (): VariantRow => ({
  sku: '',
  inventorySkuId: '',
  isListed: true,
  sellingPriceCents: '0',
  vendorPayoutCents: '',
  royaltyCents: '',
  ourShareCents: '',
  size: '',
  color: '',
  skuIsActive: false,
  stock: 0,
  effectiveSellable: false,
});

const reasonTags = (row: VariantRow) => {
  const reasons: string[] = [];
  if (!row.isListed) reasons.push('Not listed');
  if (!row.skuIsActive) reasons.push('SKU inactive');
  if (row.stock <= 0) reasons.push('Out of stock');
  return reasons;
};

const isEffectivelySellable = (row: VariantRow): boolean =>
  Boolean(row.isListed && row.skuIsActive && row.stock > 0);

export default function AdminProductVariants() {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();

  const [variants, setVariants] = useState<VariantRow[]>([]);
  const [inventorySkus, setInventorySkus] = useState<InventorySku[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [skuSearch, setSkuSearch] = useState('');

  const skuById = useMemo(() => {
    const map = new Map<string, InventorySku>();
    inventorySkus.forEach((sku) => map.set(sku.id, sku));
    return map;
  }, [inventorySkus]);

  const filteredSkus = useMemo(() => {
    const q = asText(skuSearch).toLowerCase();
    if (!q) return inventorySkus;
    return inventorySkus.filter((sku) => {
      const haystack = [sku.supplierSku, sku.merchType, sku.color, sku.size, sku.qualityTier || '']
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [inventorySkus, skuSearch]);

  const load = async () => {
    if (!productId) return;
    setLoading(true);
    setError(null);
    try {
      const [variantPayload, skuPayload] = await Promise.all([
        apiFetch(`/api/admin/products/${productId}/variants`, { cache: 'no-store' }),
        apiFetch('/api/admin/inventory-skus', { cache: 'no-store' }),
      ]);
      const variantItems = Array.isArray(variantPayload?.variants)
        ? variantPayload.variants
        : Array.isArray(variantPayload)
          ? variantPayload
          : [];
      const skuItems = Array.isArray(skuPayload?.items)
        ? skuPayload.items
        : Array.isArray(skuPayload)
          ? skuPayload
          : [];
      const normalizedSkus = skuItems.map(normalizeSku);
      setInventorySkus(normalizedSkus);
      const normalizedVariants = variantItems.map(normalizeVariant).map((row) => {
        const sku = normalizedSkus.find((item) => item.id === row.inventorySkuId);
        return {
          ...row,
          size: sku?.size || row.size,
          color: sku?.color || row.color,
          skuIsActive: sku ? sku.isActive : row.skuIsActive,
          stock: sku ? sku.stock : row.stock,
        };
      });
      setVariants(normalizedVariants);
    } catch (err: any) {
      setError(formatVariantError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [productId]);

  const updateVariant = (index: number, patch: Partial<VariantRow>) => {
    setVariants((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next[`row-${index}`];
      delete next.global;
      return next;
    });
  };

  const onSkuChange = (index: number, skuId: string) => {
    const sku = skuById.get(skuId);
    updateVariant(index, {
      inventorySkuId: skuId,
      size: sku?.size || '',
      color: sku?.color || '',
      skuIsActive: sku?.isActive || false,
      stock: sku?.stock ?? 0,
      sku: sku ? `SKU-${sku.supplierSku}` : '',
    });
  };

  const addVariant = () => {
    const firstSku = filteredSkus[0];
    const next = createNewVariantRow();
    if (firstSku) {
      next.inventorySkuId = firstSku.id;
      next.size = firstSku.size;
      next.color = firstSku.color;
      next.skuIsActive = firstSku.isActive;
      next.stock = firstSku.stock;
      next.sku = `SKU-${firstSku.supplierSku}`;
    }
    setVariants((prev) => [...prev, next]);
  };

  const removeUnsavedVariant = (index: number) => {
    setVariants((prev) => prev.filter((_, i) => i !== index));
  };

  const validateRows = (): FieldErrors => {
    const next: FieldErrors = {};
    const seenInventorySkuIds = new Set<string>();

    variants.forEach((row, index) => {
      const rowKey = `row-${index}`;
      if (!row.inventorySkuId) {
        next[rowKey] = 'Please select a supplier SKU.';
        return;
      }

      if (seenInventorySkuIds.has(row.inventorySkuId)) {
        next.global = 'This SKU is already linked to the product.';
      }
      seenInventorySkuIds.add(row.inventorySkuId);

      if (nonNegativeInteger(row.sellingPriceCents) === null) {
        next[rowKey] = 'Selling price must be a non-negative integer.';
        return;
      }
      if (row.vendorPayoutCents.trim() && nonNegativeInteger(row.vendorPayoutCents) === null) {
        next[rowKey] = 'Vendor payout must be a non-negative integer.';
        return;
      }
      if (row.royaltyCents.trim() && nonNegativeInteger(row.royaltyCents) === null) {
        next[rowKey] = 'Royalty must be a non-negative integer.';
        return;
      }
      if (row.ourShareCents.trim() && nonNegativeInteger(row.ourShareCents) === null) {
        next[rowKey] = 'Our share must be a non-negative integer.';
      }
    });
    return next;
  };

  const saveAll = async () => {
    if (!productId || saving) return;
    setError(null);
    setNotice(null);
    const validation = validateRows();
    setFieldErrors(validation);
    if (Object.keys(validation).length > 0) {
      setError(validation.global || 'Please fix the highlighted rows.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        variants: variants.map((row) => ({
          id: row.id,
          sku: asText(row.sku),
          inventory_sku_id: row.inventorySkuId,
          is_listed: row.isListed,
          selling_price_cents: nonNegativeInteger(row.sellingPriceCents) ?? 0,
          vendor_payout_cents: row.vendorPayoutCents.trim()
            ? nonNegativeInteger(row.vendorPayoutCents)
            : undefined,
          royalty_cents: row.royaltyCents.trim() ? nonNegativeInteger(row.royaltyCents) : undefined,
          our_share_cents: row.ourShareCents.trim() ? nonNegativeInteger(row.ourShareCents) : undefined,
          size: row.size,
          color: row.color,
        })),
      };
      await apiFetch(`/api/admin/products/${productId}/variants`, {
        method: 'PUT',
        body: payload,
      });
      setNotice('Variants saved successfully.');
      await load();
    } catch (err: any) {
      setError(formatVariantError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 dark:text-slate-500">
            Admin Inventory
          </p>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white">Product Variants</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/partner/admin/inventory-skus"
            className="rounded-full border border-slate-200 dark:border-white/10 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-300"
          >
            SKU Master
          </Link>
          <Link
            to="/partner/admin/products"
            className="rounded-full border border-slate-200 dark:border-white/10 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-300"
          >
            Back to items
          </Link>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-2xl border border-rose-200 dark:border-rose-500/40 bg-rose-50 dark:bg-rose-500/10 p-4"
        >
          <p className="text-xs font-black uppercase tracking-widest text-rose-600 dark:text-rose-300">{error}</p>
        </div>
      )}
      {notice && (
        <div className="rounded-2xl border border-emerald-200 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-500/10 p-4">
          <p className="text-xs font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-300">{notice}</p>
        </div>
      )}

      <div className="rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 p-5">
        <label className="block space-y-1">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
            Search SKUs for selection
          </span>
          <input
            data-testid="admin-variants-sku-search"
            value={skuSearch}
            onChange={(e) => setSkuSearch(e.target.value)}
            placeholder="Filter by supplier SKU / merch / color / size"
            className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-black/30 px-3 py-2 text-sm"
          />
        </label>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <p className="text-xs font-black uppercase tracking-widest text-slate-400 animate-pulse">Loading variants...</p>
        </div>
      ) : (
        <div className="space-y-4">
          {variants.length === 0 && (
            <div className="rounded-3xl border border-dashed border-slate-200 dark:border-white/10 p-10 text-center text-xs font-black uppercase tracking-widest text-slate-400">
              No variants configured yet.
            </div>
          )}

          {variants.map((variant, index) => {
            const rowReasonTags = reasonTags(variant);
            const selectedSku = skuById.get(variant.inventorySkuId);
            const selectableSkus =
              selectedSku && !filteredSkus.some((sku) => sku.id === selectedSku.id)
                ? [selectedSku, ...filteredSkus]
                : filteredSkus;
            const rowEffectiveSellable = isEffectivelySellable(variant);
            return (
              <div
                key={`${variant.id || 'new'}-${index}`}
                data-testid="admin-variant-row"
                className="rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 p-5"
              >
                <div className="grid gap-4 md:grid-cols-6">
                  <label className="space-y-1 md:col-span-2">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Supplier SKU *
                    </span>
                    <select
                      data-testid={`admin-variant-sku-select-${index}`}
                      value={variant.inventorySkuId}
                      onChange={(e) => onSkuChange(index, e.target.value)}
                      className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-black/20 px-3 py-2 text-sm"
                    >
                      <option value="">Select supplier SKU</option>
                      {selectableSkus.map((sku) => (
                        <option key={sku.id} value={sku.id}>
                          {sku.supplierSku} | {sku.merchType} | {sku.color}/{sku.size}
                        </option>
                      ))}
                    </select>
                    {selectedSku && (
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        {selectedSku.merchType} | {selectedSku.color}/{selectedSku.size}
                        {selectedSku.qualityTier ? ` | ${selectedSku.qualityTier}` : ''}
                      </p>
                    )}
                  </label>

                  <label className="space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Listed
                    </span>
                    <select
                      data-testid="admin-variant-listed-select"
                      value={variant.isListed ? 'true' : 'false'}
                      onChange={(e) => updateVariant(index, { isListed: e.target.value === 'true' })}
                      className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-black/20 px-3 py-2 text-sm"
                    >
                      <option value="true">Yes</option>
                      <option value="false">No</option>
                    </select>
                  </label>

                  <label className="space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Selling (cents)
                    </span>
                    <input
                      data-testid={`admin-variant-selling-price-${index}`}
                      value={variant.sellingPriceCents}
                      onChange={(e) => updateVariant(index, { sellingPriceCents: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-black/20 px-3 py-2 text-sm"
                      inputMode="numeric"
                    />
                  </label>

                  <label className="space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Vendor Payout
                    </span>
                    <input
                      value={variant.vendorPayoutCents}
                      onChange={(e) => updateVariant(index, { vendorPayoutCents: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-black/20 px-3 py-2 text-sm"
                      inputMode="numeric"
                    />
                  </label>

                  <label className="space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Royalty
                    </span>
                    <input
                      value={variant.royaltyCents}
                      onChange={(e) => updateVariant(index, { royaltyCents: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-black/20 px-3 py-2 text-sm"
                      inputMode="numeric"
                    />
                  </label>

                  <label className="space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Our Share
                    </span>
                    <input
                      value={variant.ourShareCents}
                      onChange={(e) => updateVariant(index, { ourShareCents: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-black/20 px-3 py-2 text-sm"
                      inputMode="numeric"
                    />
                  </label>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                    SKU Active:
                    <strong
                      data-testid="admin-variant-sku-active"
                      className={variant.skuIsActive ? 'text-emerald-600 ml-1' : 'text-slate-500 ml-1'}
                    >
                      {variant.skuIsActive ? 'Yes' : 'No'}
                    </strong>
                  </span>
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                    SKU Stock:
                    <strong data-testid="admin-variant-stock" className="ml-1 text-slate-700 dark:text-slate-300">
                      {variant.stock}
                    </strong>
                  </span>
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                    Effective Sellable:
                    <strong
                      data-testid="admin-variant-effective-sellable"
                      className={rowEffectiveSellable ? 'text-emerald-600 ml-1' : 'text-rose-500 ml-1'}
                    >
                      {rowEffectiveSellable ? 'Yes' : 'No'}
                    </strong>
                  </span>
                  {rowReasonTags.length > 0 && (
                    <span data-testid="admin-variant-status-reasons" className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-300">
                      {rowReasonTags.join(' | ')}
                    </span>
                  )}
                  {!variant.id && (
                    <button
                      type="button"
                      onClick={() => removeUnsavedVariant(index)}
                      className="ml-auto rounded-full border border-rose-200 dark:border-rose-500/30 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-rose-600 dark:text-rose-300"
                    >
                      Remove
                    </button>
                  )}
                </div>
                {fieldErrors[`row-${index}`] && (
                  <p className="mt-3 text-[10px] font-bold uppercase tracking-wider text-rose-500">
                    {fieldErrors[`row-${index}`]}
                  </p>
                )}
              </div>
            );
          })}

          <div className="sticky bottom-0 z-20 flex flex-wrap items-center gap-4 rounded-3xl border border-slate-200 dark:border-white/10 bg-white/90 dark:bg-slate-950/90 p-4 backdrop-blur">
            <button
              type="button"
              onClick={addVariant}
              className="rounded-full border border-slate-200 dark:border-white/10 px-6 py-3 text-[10px] font-black uppercase tracking-widest text-slate-800 dark:text-white"
            >
              Add Variant
            </button>
            <button
              type="button"
              data-testid="admin-variant-save"
              onClick={saveAll}
              disabled={saving}
              className="rounded-full bg-slate-900 dark:bg-white px-8 py-3 text-[10px] font-black uppercase tracking-widest text-white dark:text-slate-950 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Variants'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/partner/admin/products')}
              className="ml-auto rounded-full border border-slate-200 dark:border-white/10 px-6 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-300"
            >
              Finish
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
