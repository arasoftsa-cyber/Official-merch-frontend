import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../../../shared/api/http';

type InventorySku = {
  id: string;
  supplierSku: string;
  supplier_sku?: string;
  merchType: string;
  merch_type?: string;
  qualityTier?: string | null;
  quality_tier?: string | null;
  color: string;
  size: string;
  stock: number;
  isActive: boolean;
  is_active?: boolean;
  supplierCostCents?: number | null;
  supplier_cost_cents?: number | null;
  mrpCents?: number | null;
  mrp_cents?: number | null;
};

type FieldErrors = Record<string, string>;

type SkuDraft = {
  supplierSku: string;
  merchType: string;
  qualityTier: string;
  color: string;
  size: string;
  stock: string;
  supplierCostCents: string;
  mrpCents: string;
  isActive: boolean;
};

const emptyDraft = (): SkuDraft => ({
  supplierSku: '',
  merchType: '',
  qualityTier: '',
  color: '',
  size: '',
  stock: '0',
  supplierCostCents: '',
  mrpCents: '',
  isActive: true,
});

const asText = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');
const asNumberString = (value: unknown): string => {
  if (value === null || value === undefined || value === '') return '';
  const num = Number(value);
  if (!Number.isFinite(num)) return '';
  return `${num}`;
};

const toHumanError = (error: any): string => {
  const raw = asText(error?.message).toLowerCase();
  if (raw.includes('supplier_sku_conflict')) {
    return 'Supplier SKU already exists. Please use a unique value.';
  }
  if (raw.includes('supplier_sku_required')) return 'Supplier SKU is required.';
  if (raw.includes('merch_type_required')) return 'Merch type is required.';
  if (raw.includes('size_required')) return 'Size is required.';
  if (raw.includes('color_required')) return 'Color is required.';
  if (raw.includes('invalid_stock')) return 'Stock cannot be negative.';
  if (raw.includes('invalid_mrp_cents')) return 'MRP must be a non-negative number.';
  if (raw.includes('invalid_supplier_cost_cents')) {
    return 'Supplier cost must be a non-negative number.';
  }
  if (raw.includes('no_fields')) return 'No changes to save yet.';
  if (raw.includes('failed to fetch')) return 'Network error. Please try again.';
  return "We couldn't update SKU details right now. Please try again.";
};

const parseNonNegative = (value: string): number | null => {
  const trimmed = asText(value);
  if (!trimmed) return null;
  const numeric = Number(trimmed);
  if (!Number.isFinite(numeric) || numeric < 0 || !Number.isInteger(numeric)) return null;
  return numeric;
};

const normalizeSku = (row: any): InventorySku => ({
  id: String(row?.id || ''),
  supplierSku: asText(row?.supplierSku || row?.supplier_sku),
  supplier_sku: asText(row?.supplier_sku || row?.supplierSku),
  merchType: asText(row?.merchType || row?.merch_type),
  merch_type: asText(row?.merch_type || row?.merchType),
  qualityTier: row?.qualityTier ?? row?.quality_tier ?? null,
  quality_tier: row?.quality_tier ?? row?.qualityTier ?? null,
  color: asText(row?.color),
  size: asText(row?.size),
  stock: Number(row?.stock ?? 0),
  isActive: Boolean(row?.isActive ?? row?.is_active),
  is_active: Boolean(row?.is_active ?? row?.isActive),
  supplierCostCents:
    row?.supplierCostCents === 0 ||
    row?.supplier_cost_cents === 0 ||
    row?.supplierCostCents != null ||
    row?.supplier_cost_cents != null
      ? Number(row?.supplierCostCents ?? row?.supplier_cost_cents ?? 0)
      : null,
  supplier_cost_cents:
    row?.supplier_cost_cents === 0 ||
    row?.supplierCostCents === 0 ||
    row?.supplier_cost_cents != null ||
    row?.supplierCostCents != null
      ? Number(row?.supplier_cost_cents ?? row?.supplierCostCents ?? 0)
      : null,
  mrpCents:
    row?.mrpCents === 0 || row?.mrp_cents === 0 || row?.mrpCents != null || row?.mrp_cents != null
      ? Number(row?.mrpCents ?? row?.mrp_cents ?? 0)
      : null,
  mrp_cents:
    row?.mrp_cents === 0 || row?.mrpCents === 0 || row?.mrp_cents != null || row?.mrpCents != null
      ? Number(row?.mrp_cents ?? row?.mrpCents ?? 0)
      : null,
});

export default function AdminSkuMasterPage() {
  const [items, setItems] = useState<InventorySku[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const [merchTypeFilter, setMerchTypeFilter] = useState('');
  const [colorFilter, setColorFilter] = useState('');
  const [sizeFilter, setSizeFilter] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'true' | 'false'>('all');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSkuId, setEditingSkuId] = useState<string | null>(null);
  const [draft, setDraft] = useState<SkuDraft>(emptyDraft);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const [stockDraftById, setStockDraftById] = useState<Record<string, string>>({});

  const merchTypeOptions = useMemo(
    () =>
      Array.from(new Set(items.map((item) => item.merchType).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b)
      ),
    [items]
  );

  const fetchSkus = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set('q', query.trim());
      if (merchTypeFilter.trim()) params.set('merch_type', merchTypeFilter.trim());
      if (colorFilter.trim()) params.set('color', colorFilter.trim());
      if (sizeFilter.trim()) params.set('size', sizeFilter.trim());
      if (activeFilter !== 'all') params.set('is_active', activeFilter);
      const suffix = params.toString() ? `?${params.toString()}` : '';
      const payload = await apiFetch(`/admin/inventory-skus${suffix}`);
      const rows = Array.isArray(payload?.items) ? payload.items : Array.isArray(payload) ? payload : [];
      const normalized = rows.map(normalizeSku);
      setItems(normalized);
      setStockDraftById((prev) => {
        const next = { ...prev };
        normalized.forEach((row) => {
          if (typeof next[row.id] === 'undefined') next[row.id] = `${row.stock}`;
        });
        return next;
      });
    } catch (err: any) {
      setError(toHumanError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSkus();
  }, []);

  const applyFilters = async () => {
    await fetchSkus();
  };

  const openCreate = () => {
    setEditingSkuId(null);
    setDraft(emptyDraft());
    setFieldErrors({});
    setNotice(null);
    setError(null);
    setIsModalOpen(true);
  };

  const openEdit = (item: InventorySku) => {
    setEditingSkuId(item.id);
    setDraft({
      supplierSku: item.supplierSku,
      merchType: item.merchType,
      qualityTier: asText(item.qualityTier),
      color: item.color,
      size: item.size,
      stock: `${item.stock}`,
      supplierCostCents: asNumberString(item.supplierCostCents ?? item.supplier_cost_cents),
      mrpCents: asNumberString(item.mrpCents ?? item.mrp_cents),
      isActive: item.isActive,
    });
    setFieldErrors({});
    setNotice(null);
    setError(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingSkuId(null);
    setFieldErrors({});
    setDraft(emptyDraft());
  };

  const validateDraft = (): FieldErrors => {
    const next: FieldErrors = {};
    if (!asText(draft.supplierSku)) next.supplierSku = 'Supplier SKU is required.';
    if (!asText(draft.merchType)) next.merchType = 'Merch type is required.';
    if (!asText(draft.color)) next.color = 'Color is required.';
    if (!asText(draft.size)) next.size = 'Size is required.';
    if (parseNonNegative(draft.stock) === null) next.stock = 'Stock cannot be negative.';
    if (draft.supplierCostCents.trim() && parseNonNegative(draft.supplierCostCents) === null) {
      next.supplierCostCents = 'Supplier cost must be a non-negative integer.';
    }
    if (draft.mrpCents.trim() && parseNonNegative(draft.mrpCents) === null) {
      next.mrpCents = 'MRP must be a non-negative integer.';
    }
    return next;
  };

  const saveSku = async () => {
    const validation = validateDraft();
    setFieldErrors(validation);
    if (Object.keys(validation).length > 0) return;

    setSaving(true);
    setError(null);
    setNotice(null);
    const body: Record<string, unknown> = {
      supplier_sku: asText(draft.supplierSku),
      merch_type: asText(draft.merchType),
      quality_tier: asText(draft.qualityTier) || null,
      color: asText(draft.color),
      size: asText(draft.size),
      stock: parseNonNegative(draft.stock) ?? 0,
      is_active: draft.isActive,
    };
    if (draft.supplierCostCents.trim()) {
      body.supplier_cost_cents = parseNonNegative(draft.supplierCostCents);
    } else if (editingSkuId) {
      body.supplier_cost_cents = null;
    }
    if (draft.mrpCents.trim()) {
      body.mrp_cents = parseNonNegative(draft.mrpCents);
    } else if (editingSkuId) {
      body.mrp_cents = null;
    }

    try {
      if (editingSkuId) {
        await apiFetch(`/admin/inventory-skus/${editingSkuId}`, {
          method: 'PATCH',
          body,
        });
        setNotice('SKU updated successfully.');
      } else {
        await apiFetch('/admin/inventory-skus', {
          method: 'POST',
          body,
        });
        setNotice('SKU created successfully.');
      }
      closeModal();
      await fetchSkus();
    } catch (err: any) {
      setError(toHumanError(err));
    } finally {
      setSaving(false);
    }
  };

  const patchSku = async (id: string, body: Record<string, unknown>, successMessage: string) => {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await apiFetch(`/admin/inventory-skus/${id}`, {
        method: 'PATCH',
        body,
      });
      setNotice(successMessage);
      await fetchSkus();
    } catch (err: any) {
      setError(toHumanError(err));
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (item: InventorySku) => {
    await patchSku(
      item.id,
      { is_active: !item.isActive },
      item.isActive ? 'SKU deactivated.' : 'SKU activated.'
    );
  };

  const saveStock = async (item: InventorySku) => {
    const draftValue = asText(stockDraftById[item.id] ?? `${item.stock}`);
    const parsed = parseNonNegative(draftValue);
    if (parsed === null) {
      setError('Stock cannot be negative.');
      return;
    }
    await patchSku(item.id, { stock: parsed }, 'Stock updated.');
  };

  const runBulkDeactivate = async () => {
    if (!asText(merchTypeFilter)) {
      setError('Select a merch type before running bulk deactivate.');
      return;
    }
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const payload = await apiFetch('/admin/inventory-skus/bulk-deactivate', {
        method: 'POST',
        body: {
          merch_type: asText(merchTypeFilter),
          color: asText(colorFilter) || null,
          size: asText(sizeFilter) || null,
        },
      });
      const count = Number(payload?.updatedCount ?? 0);
      setNotice(`Bulk deactivate complete. ${count} SKU(s) updated.`);
      await fetchSkus();
    } catch (err: any) {
      setError(toHumanError(err));
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
          <h1 className="text-3xl font-black text-slate-900 dark:text-white">SKU Master</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/partner/admin/products"
            className="rounded-full border border-slate-200 dark:border-white/10 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-300"
          >
            Products
          </Link>
          <button
            type="button"
            data-testid="admin-sku-master-create"
            onClick={openCreate}
            className="rounded-full bg-slate-900 dark:bg-white px-6 py-2 text-[10px] font-black uppercase tracking-widest text-white dark:text-slate-950"
          >
            Create SKU
          </button>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-2xl border border-rose-200 dark:border-rose-500/40 bg-rose-50 dark:bg-rose-500/10 px-4 py-3 text-xs font-black uppercase tracking-widest text-rose-600 dark:text-rose-300"
        >
          {error}
        </div>
      )}
      {notice && (
        <div className="rounded-2xl border border-emerald-200 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-500/10 px-4 py-3 text-xs font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-300">
          {notice}
        </div>
      )}

      <section className="rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 p-5 shadow-sm">
        <div className="grid gap-3 md:grid-cols-5">
          <label className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Search
            </span>
            <input
              data-testid="admin-sku-master-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="SKU / merch / color / size"
              className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-black/20 px-3 py-2 text-sm"
            />
          </label>
          <label className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Merch Type
            </span>
            <input
              value={merchTypeFilter}
              onChange={(e) => setMerchTypeFilter(e.target.value)}
              placeholder="e.g. tshirt"
              list="sku-merch-types"
              className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-black/20 px-3 py-2 text-sm"
            />
            <datalist id="sku-merch-types">
              {merchTypeOptions.map((entry) => (
                <option key={entry} value={entry} />
              ))}
            </datalist>
          </label>
          <label className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Color
            </span>
            <input
              value={colorFilter}
              onChange={(e) => setColorFilter(e.target.value)}
              placeholder="e.g. black"
              className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-black/20 px-3 py-2 text-sm"
            />
          </label>
          <label className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Size
            </span>
            <input
              value={sizeFilter}
              onChange={(e) => setSizeFilter(e.target.value)}
              placeholder="e.g. M"
              className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-black/20 px-3 py-2 text-sm"
            />
          </label>
          <label className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Active
            </span>
            <select
              value={activeFilter}
              onChange={(e) => setActiveFilter(e.target.value as 'all' | 'true' | 'false')}
              className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-black/20 px-3 py-2 text-sm"
            >
              <option value="all">All</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            data-testid="admin-sku-master-apply-filters"
            onClick={applyFilters}
            className="rounded-full border border-slate-200 dark:border-white/10 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-white"
          >
            Apply Filters
          </button>
          <button
            type="button"
            data-testid="admin-sku-master-bulk-deactivate"
            onClick={runBulkDeactivate}
            disabled={saving || !asText(merchTypeFilter)}
            className="rounded-full border border-amber-300 dark:border-amber-500/40 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-amber-700 dark:text-amber-300 disabled:opacity-50"
          >
            Bulk Deactivate Filtered
          </button>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Bulk operation uses merch type + optional color/size filters.
          </p>
        </div>
      </section>

      <section className="overflow-x-auto rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5">
        <table className="min-w-full divide-y divide-slate-100 dark:divide-white/10">
          <thead className="bg-slate-50 dark:bg-white/5">
            <tr className="text-left text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
              <th className="px-4 py-3">Supplier SKU</th>
              <th className="px-4 py-3">Merch</th>
              <th className="px-4 py-3">Quality</th>
              <th className="px-4 py-3">Color</th>
              <th className="px-4 py-3">Size</th>
              <th className="px-4 py-3">Stock</th>
              <th className="px-4 py-3">Active</th>
              <th className="px-4 py-3">Cost</th>
              <th className="px-4 py-3">MRP</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={10} className="px-4 py-10 text-center text-xs font-black uppercase tracking-widest text-slate-400">
                  Loading SKU master...
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-10 text-center text-xs font-black uppercase tracking-widest text-slate-400">
                  No SKUs found.
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} data-testid="admin-sku-master-row" className="border-t border-slate-100 dark:border-white/10">
                  <td className="px-4 py-3 text-sm font-bold text-slate-900 dark:text-white">{item.supplierSku}</td>
                  <td className="px-4 py-3 text-xs font-bold uppercase text-slate-700 dark:text-slate-200">{item.merchType}</td>
                  <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300">{item.qualityTier || '-'}</td>
                  <td className="px-4 py-3 text-xs uppercase text-slate-700 dark:text-slate-300">{item.color || '-'}</td>
                  <td className="px-4 py-3 text-xs uppercase text-slate-700 dark:text-slate-300">{item.size || '-'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <input
                        data-testid="admin-sku-master-stock-input"
                        value={stockDraftById[item.id] ?? `${item.stock}`}
                        onChange={(e) =>
                          setStockDraftById((prev) => ({ ...prev, [item.id]: e.target.value }))
                        }
                        className="w-20 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-black/20 px-2 py-1 text-xs"
                        inputMode="numeric"
                      />
                      <button
                        type="button"
                        data-testid="admin-sku-master-stock-save"
                        onClick={() => saveStock(item)}
                        disabled={saving}
                        className="rounded-lg border border-slate-200 dark:border-white/10 px-2 py-1 text-[10px] font-black uppercase tracking-widest"
                      >
                        Save
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-widest ${
                        item.isActive
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300'
                          : 'bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-300'
                      }`}
                    >
                      {item.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-700 dark:text-slate-300">
                    {item.supplierCostCents ?? item.supplier_cost_cents ?? '-'}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-700 dark:text-slate-300">
                    {item.mrpCents ?? item.mrp_cents ?? '-'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        data-testid="admin-sku-master-edit"
                        onClick={() => openEdit(item)}
                        className="rounded-lg border border-slate-200 dark:border-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        data-testid="admin-sku-master-toggle"
                        onClick={() => toggleActive(item)}
                        disabled={saving}
                        className="rounded-lg border border-slate-200 dark:border-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest"
                      >
                        {item.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-2xl rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950 p-6">
            <h2 className="text-xl font-black text-slate-900 dark:text-white">
              {editingSkuId ? 'Edit SKU' : 'Create SKU'}
            </h2>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="space-y-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Supplier SKU *</span>
                <input
                  data-testid="admin-sku-form-supplier-sku"
                  value={draft.supplierSku}
                  onChange={(e) => setDraft((prev) => ({ ...prev, supplierSku: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-black/20 px-3 py-2 text-sm"
                />
                {fieldErrors.supplierSku && (
                  <p className="text-[10px] font-bold uppercase tracking-wider text-rose-500">{fieldErrors.supplierSku}</p>
                )}
              </label>
              <label className="space-y-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Merch Type *</span>
                <input
                  data-testid="admin-sku-form-merch-type"
                  value={draft.merchType}
                  onChange={(e) => setDraft((prev) => ({ ...prev, merchType: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-black/20 px-3 py-2 text-sm"
                />
                {fieldErrors.merchType && (
                  <p className="text-[10px] font-bold uppercase tracking-wider text-rose-500">{fieldErrors.merchType}</p>
                )}
              </label>
              <label className="space-y-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Quality Tier</span>
                <input
                  value={draft.qualityTier}
                  onChange={(e) => setDraft((prev) => ({ ...prev, qualityTier: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-black/20 px-3 py-2 text-sm"
                />
              </label>
              <label className="space-y-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Color *</span>
                <input
                  data-testid="admin-sku-form-color"
                  value={draft.color}
                  onChange={(e) => setDraft((prev) => ({ ...prev, color: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-black/20 px-3 py-2 text-sm"
                />
                {fieldErrors.color && (
                  <p className="text-[10px] font-bold uppercase tracking-wider text-rose-500">{fieldErrors.color}</p>
                )}
              </label>
              <label className="space-y-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Size *</span>
                <input
                  data-testid="admin-sku-form-size"
                  value={draft.size}
                  onChange={(e) => setDraft((prev) => ({ ...prev, size: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-black/20 px-3 py-2 text-sm"
                />
                {fieldErrors.size && (
                  <p className="text-[10px] font-bold uppercase tracking-wider text-rose-500">{fieldErrors.size}</p>
                )}
              </label>
              <label className="space-y-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Stock *</span>
                <input
                  data-testid="admin-sku-form-stock"
                  inputMode="numeric"
                  value={draft.stock}
                  onChange={(e) => setDraft((prev) => ({ ...prev, stock: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-black/20 px-3 py-2 text-sm"
                />
                {fieldErrors.stock && (
                  <p className="text-[10px] font-bold uppercase tracking-wider text-rose-500">{fieldErrors.stock}</p>
                )}
              </label>
              <label className="space-y-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Supplier Cost (paise)</span>
                <input
                  value={draft.supplierCostCents}
                  onChange={(e) =>
                    setDraft((prev) => ({ ...prev, supplierCostCents: e.target.value }))
                  }
                  className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-black/20 px-3 py-2 text-sm"
                />
                {fieldErrors.supplierCostCents && (
                  <p className="text-[10px] font-bold uppercase tracking-wider text-rose-500">{fieldErrors.supplierCostCents}</p>
                )}
              </label>
              <label className="space-y-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">MRP (paise)</span>
                <input
                  value={draft.mrpCents}
                  onChange={(e) => setDraft((prev) => ({ ...prev, mrpCents: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-black/20 px-3 py-2 text-sm"
                />
                {fieldErrors.mrpCents && (
                  <p className="text-[10px] font-bold uppercase tracking-wider text-rose-500">{fieldErrors.mrpCents}</p>
                )}
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={draft.isActive}
                  onChange={(e) => setDraft((prev) => ({ ...prev, isActive: e.target.checked }))}
                />
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">SKU Active</span>
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeModal}
                className="rounded-full border border-slate-200 dark:border-white/10 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-500"
              >
                Cancel
              </button>
              <button
                type="button"
                data-testid="admin-sku-form-save"
                onClick={saveSku}
                disabled={saving}
                className="rounded-full bg-slate-900 dark:bg-white px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white dark:text-slate-950 disabled:opacity-50"
              >
                {saving ? 'Saving...' : editingSkuId ? 'Save SKU' : 'Create SKU'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
