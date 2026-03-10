import React, { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { getMe } from '../../../shared/api/appApi';
import { apiFetch, apiFetchForm, API_BASE } from '../../../shared/api/http';
import { getAccessToken } from '../../../shared/auth/tokenStore';
import { useToast } from '../../../shared/components/ux/ToastHost';
import { Page, Container } from '../../../shared/ui/Page';
import { formatOnboardingSkuTypeLabel } from '../../../shared/utils/onboardingSkuTypes';

import type { NewMerchErrors, NewMerchFormState, StatusFilter } from './ArtistProductsPage.utils';
import {
  SKU_OPTIONS,
  formatStatusLabel,
  formatUpdatedDate,
  getProductId,
  getSelectedSkuTypes,
  getStatusPillClass,
  initialNewMerchForm,
  isAllowedDesignImage,
  isProductActive,
  isProductToggleable,
  normalizeProductStatus,
  normalizeServerFieldMessage,
  parseFormErrorMessage,
  readProductDesignImageUrl,
  readProductSkuTypes,
  readProductStory,
  readRejectionReason,
} from './ArtistProductsPage.utils';
export default function ArtistProductsPage() {
  const token = getAccessToken();
  const navigate = useNavigate();
  const toast = useToast();
  const [products, setProducts] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingIds, setPendingIds] = useState<Record<string, boolean>>({});
  const [userRole, setUserRole] = useState<string | null>(null);
  const [showNewMerchForm, setShowNewMerchForm] = useState(false);
  const [newMerchForm, setNewMerchForm] = useState<NewMerchFormState>(initialNewMerchForm);
  const [newMerchTouched, setNewMerchTouched] = useState<Record<keyof NewMerchErrors, boolean>>({
    merchName: false,
    merchStory: false,
    designImage: false,
    skuTypes: false,
  });
  const [newMerchErrors, setNewMerchErrors] = useState<NewMerchErrors>({});
  const [newMerchSubmitting, setNewMerchSubmitting] = useState(false);
  const [newMerchSubmitError, setNewMerchSubmitError] = useState<string | null>(null);
  const [newMerchSubmitSuccess, setNewMerchSubmitSuccess] = useState<string | null>(null);

  const isArtistRole = String(userRole || '').toLowerCase() === 'artist';

  const loadProducts = async () => {
    setLoading(true);
    setError(null);
    try {
      const payload: any = await apiFetch('/api/artist/products');
      const items = Array.isArray(payload?.items)
        ? payload.items
        : Array.isArray(payload)
          ? payload
          : [];
      setProducts(items);
    } catch (err: any) {
      setError(err?.message ?? 'Unable to load products');
    } finally {
      setLoading(false);
    }
  };

  const loadRole = async () => {
    try {
      const me: any = await getMe();
      setUserRole(
        me?.role ??
        (Array.isArray(me?.roles) ? me.roles[0] : null) ??
        me?.user?.role ??
        null
      );
    } catch {
      setUserRole(null);
    }
  };

  useEffect(() => {
    void loadProducts();
    void loadRole();
  }, []);

  const setPending = (productId: string, pending: boolean) => {
    setPendingIds((prev) => {
      const next = { ...prev };
      if (pending) {
        next[productId] = true;
      } else {
        delete next[productId];
      }
      return next;
    });
  };

  const validateNewMerch = (form: NewMerchFormState): NewMerchErrors => {
    const nextErrors: NewMerchErrors = {};

    if (!form.merchName.trim()) {
      nextErrors.merchName = 'Merch name is required.';
    }

    if (!form.merchStory.trim()) {
      nextErrors.merchStory = 'Merch story is required.';
    }

    if (!form.designImage) {
      nextErrors.designImage = 'Design image is required.';
    } else if (!isAllowedDesignImage(form.designImage)) {
      nextErrors.designImage = 'Upload a PNG, JPG, or SVG file.';
    }

    if (getSelectedSkuTypes(form.skuTypes).length < 1) {
      nextErrors.skuTypes = 'Select at least one SKU type.';
    }

    return nextErrors;
  };

  const applyNewMerchValidation = (nextForm: NewMerchFormState) => {
    const validation = validateNewMerch(nextForm);
    setNewMerchErrors(validation);
    return validation;
  };

  const markFieldTouched = (field: keyof NewMerchErrors) => {
    setNewMerchTouched((prev) => ({ ...prev, [field]: true }));
  };

  const updateNewMerchForm = (updater: (prev: NewMerchFormState) => NewMerchFormState) => {
    setNewMerchForm((prev) => {
      const next = updater(prev);
      applyNewMerchValidation(next);
      return next;
    });
  };

  const resetNewMerchForm = () => {
    const next = initialNewMerchForm();
    setNewMerchForm(next);
    setNewMerchTouched({
      merchName: false,
      merchStory: false,
      designImage: false,
      skuTypes: false,
    });
    setNewMerchErrors({});
    setNewMerchSubmitError(null);
  };

  const openNewMerchForm = () => {
    resetNewMerchForm();
    setNewMerchSubmitSuccess(null);
    setShowNewMerchForm(true);
  };

  const closeNewMerchForm = () => {
    setShowNewMerchForm(false);
    setNewMerchSubmitError(null);
  };

  const submitNewMerchRequest = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isArtistRole) return;

    const touchedAll: Record<keyof NewMerchErrors, boolean> = {
      merchName: true,
      merchStory: true,
      designImage: true,
      skuTypes: true,
    };
    setNewMerchTouched(touchedAll);

    const validation = validateNewMerch(newMerchForm);
    setNewMerchErrors(validation);
    if (Object.keys(validation).length > 0) {
      setNewMerchSubmitError('Please fix the highlighted fields.');
      return;
    }

    const selectedSkuTypes = getSelectedSkuTypes(newMerchForm.skuTypes);
    const designImage = newMerchForm.designImage;
    if (!designImage) return;

    const formData = new FormData();
    formData.append('merch_name', newMerchForm.merchName.trim());
    formData.append('merch_story', newMerchForm.merchStory.trim());
    formData.append('design_image', designImage);
    formData.append('sku_types', JSON.stringify(selectedSkuTypes));

    setNewMerchSubmitting(true);
    setNewMerchSubmitError(null);

    try {
      await apiFetchForm('/artist/products/onboarding', formData, { method: 'POST' });
      closeNewMerchForm();
      resetNewMerchForm();
      setNewMerchSubmitSuccess('Your merch request has been submitted for review.');
      toast.notify('Your merch request has been submitted for review.', 'success');
      setStatusFilter('all');
      await loadProducts();
    } catch (err: any) {
      const details = Array.isArray(err?.details) ? err.details : [];
      const mappedErrors: NewMerchErrors = {};
      for (const detail of details) {
        const field = String(detail?.field ?? '').toLowerCase();
        const message = normalizeServerFieldMessage(
          field,
          String(detail?.message ?? '').trim()
        );
        if (!message) continue;
        if (field.includes('merch_name') && !mappedErrors.merchName) mappedErrors.merchName = message;
        if (field.includes('merch_story') && !mappedErrors.merchStory) mappedErrors.merchStory = message;
        if (field.includes('design_image') && !mappedErrors.designImage) mappedErrors.designImage = message;
        if (field.includes('sku_types') && !mappedErrors.skuTypes) mappedErrors.skuTypes = message;
      }
      if (Object.keys(mappedErrors).length > 0) {
        setNewMerchErrors((prev) => ({ ...prev, ...mappedErrors }));
      }
      setNewMerchSubmitError(parseFormErrorMessage(err));
    } finally {
      setNewMerchSubmitting(false);
    }
  };

  const toggleProductActive = async (product: any) => {
    const productId = getProductId(product);
    if (!productId || !token || !isArtistRole || !isProductToggleable(product)) {
      return;
    }

    const current = isProductActive(product);
    const nextActive = !current;

    setPending(productId, true);
    setProducts((prev) =>
      prev.map((item) => {
        if (getProductId(item) !== productId) return item;
        return {
          ...item,
          is_active: nextActive,
          isActive: nextActive,
          status: nextActive ? 'active' : 'inactive',
        };
      })
    );

    try {
      const response = await fetch(`${API_BASE}/api/products/${productId}/status`, {
        method: 'PATCH',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ active: nextActive }),
      });

      if (!response.ok) {
        const fallback = await fetch(`${API_BASE}/api/products/${productId}`, {
          method: 'PATCH',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ active: nextActive }),
        });

        if (!fallback.ok) {
          const payloadError = await fallback.json().catch(() => null);
          const message =
            payloadError?.message ??
            payloadError?.error ??
            `Server error (${fallback.status})`;
          throw new Error(message);
        }
      }

      toast.notify(`Product set to ${nextActive ? 'active' : 'inactive'}`, 'success');
      await loadProducts();
    } catch (err: any) {
      setProducts((prev) =>
        prev.map((item) => {
          if (getProductId(item) !== productId) return item;
          return {
            ...item,
            is_active: current,
            isActive: current,
            status: current ? 'active' : 'inactive',
          };
        })
      );
      toast.notify(err?.message ?? 'Failed to update product status', 'error');
    } finally {
      setPending(productId, false);
    }
  };

  const visibleProducts = useMemo(
    () =>
      products.filter((product) => {
        const status = normalizeProductStatus(product);
        if (statusFilter === 'all') return true;
        return status === statusFilter;
      }),
    [products, statusFilter]
  );

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return (
    <Page>
      <Container className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-slate-500 dark:text-slate-400">Artist</p>
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Artist Products</h1>
          </div>
          <div className="flex items-center gap-2">
            {isArtistRole && (
              <button
                type="button"
                data-testid="artist-new-merch-button"
                onClick={openNewMerchForm}
                className="rounded-full border border-indigo-300 dark:border-indigo-400/40 bg-indigo-50 dark:bg-indigo-500/20 px-4 py-2 text-xs font-bold uppercase tracking-[0.25em] text-indigo-700 dark:text-indigo-100 hover:bg-indigo-100 dark:hover:bg-indigo-500/30 transition-colors"
              >
                New Merchandise
              </button>
            )}
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-slate-600 dark:text-slate-300">
              <span>Status</span>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
                className="rounded-full border border-slate-200 dark:border-white/20 bg-white dark:bg-slate-900 px-3 py-1 text-xs text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-slate-400 dark:focus:ring-white/40"
              >
                <option value="all">All</option>
                <option value="pending">Pending</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          </div>
        </div>

        {newMerchSubmitSuccess && (
          <p
            data-testid="artist-merch-submit-success"
            className="rounded-lg border border-emerald-300/60 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-200"
          >
            {newMerchSubmitSuccess}
          </p>
        )}

        {showNewMerchForm && isArtistRole && (
          <form
            data-testid="artist-new-merch-form"
            onSubmit={submitNewMerchRequest}
            className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 p-4 md:p-5 space-y-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">New Merchandise Request</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Submit your merch concept for admin review.
                </p>
              </div>
              <button
                type="button"
                onClick={closeNewMerchForm}
                className="rounded-full border border-slate-300 dark:border-white/20 px-3 py-1 text-[10px] uppercase tracking-[0.25em] text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/10 transition-colors"
              >
                Close
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1 md:col-span-1">
                <label htmlFor="artist-merch-name" className="text-xs uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400">
                  Merch Name
                </label>
                <input
                  id="artist-merch-name"
                  data-testid="artist-merch-name"
                  value={newMerchForm.merchName}
                  onChange={(event) => {
                    setNewMerchSubmitSuccess(null);
                    updateNewMerchForm((prev) => ({ ...prev, merchName: event.target.value }));
                  }}
                  onBlur={() => markFieldTouched('merchName')}
                  className={`w-full rounded-xl border bg-white dark:bg-black/20 px-3 py-2 text-sm text-slate-900 dark:text-white outline-none focus:ring-1 ${newMerchTouched.merchName && newMerchErrors.merchName ? 'border-rose-400 dark:border-rose-400/60 focus:ring-rose-400 dark:focus:ring-rose-400/60' : 'border-slate-200 dark:border-white/10 focus:ring-slate-400 dark:focus:ring-white/40'}`}
                  placeholder="Name your merch concept"
                />
                <p className={`text-[11px] ${newMerchTouched.merchName && newMerchErrors.merchName ? 'text-rose-500 dark:text-rose-300' : 'text-slate-500 dark:text-slate-400'}`}>
                  {newMerchTouched.merchName && newMerchErrors.merchName
                    ? newMerchErrors.merchName
                    : 'Required.'}
                </p>
              </div>

              <div className="space-y-1 md:col-span-1">
                <label htmlFor="artist-merch-design-image" className="text-xs uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400">
                  Design Image
                </label>
                <input
                  id="artist-merch-design-image"
                  data-testid="artist-merch-design-image"
                  type="file"
                  accept=".png,.jpg,.jpeg,.svg,image/png,image/jpeg,image/svg+xml"
                  onChange={(event) => {
                    setNewMerchSubmitSuccess(null);
                    const selected = event.target.files?.[0] || null;
                    updateNewMerchForm((prev) => ({ ...prev, designImage: selected }));
                  }}
                  onBlur={() => markFieldTouched('designImage')}
                  className={`w-full rounded-xl border bg-white dark:bg-black/20 px-3 py-2 text-sm text-slate-900 dark:text-white file:mr-3 file:rounded-full file:border-0 file:bg-slate-200 dark:file:bg-white/15 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-slate-700 dark:file:text-slate-100 ${newMerchTouched.designImage && newMerchErrors.designImage ? 'border-rose-400 dark:border-rose-400/60' : 'border-slate-200 dark:border-white/10'}`}
                />
                <p className={`text-[11px] ${newMerchTouched.designImage && newMerchErrors.designImage ? 'text-rose-500 dark:text-rose-300' : 'text-slate-500 dark:text-slate-400'}`}>
                  {newMerchTouched.designImage && newMerchErrors.designImage
                    ? newMerchErrors.designImage
                    : 'Required. PNG, JPG, or SVG.'}
                </p>
              </div>

              <div className="space-y-1 md:col-span-2">
                <label htmlFor="artist-merch-story" className="text-xs uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400">
                  Merch Story
                </label>
                <textarea
                  id="artist-merch-story"
                  data-testid="artist-merch-story"
                  value={newMerchForm.merchStory}
                  onChange={(event) => {
                    setNewMerchSubmitSuccess(null);
                    updateNewMerchForm((prev) => ({ ...prev, merchStory: event.target.value }));
                  }}
                  onBlur={() => markFieldTouched('merchStory')}
                  className={`w-full min-h-[100px] rounded-xl border bg-white dark:bg-black/20 px-3 py-2 text-sm text-slate-900 dark:text-white outline-none focus:ring-1 ${newMerchTouched.merchStory && newMerchErrors.merchStory ? 'border-rose-400 dark:border-rose-400/60 focus:ring-rose-400 dark:focus:ring-rose-400/60' : 'border-slate-200 dark:border-white/10 focus:ring-slate-400 dark:focus:ring-white/40'}`}
                  placeholder="Describe the story behind this merch drop."
                />
                <p className={`text-[11px] ${newMerchTouched.merchStory && newMerchErrors.merchStory ? 'text-rose-500 dark:text-rose-300' : 'text-slate-500 dark:text-slate-400'}`}>
                  {newMerchTouched.merchStory && newMerchErrors.merchStory
                    ? newMerchErrors.merchStory
                    : 'Required.'}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400">SKU Types</p>
              <div className="grid gap-2 md:grid-cols-2">
                {SKU_OPTIONS.map((option) => (
                  <label
                    key={option.value}
                    className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 px-3 py-2 text-sm text-slate-800 dark:text-slate-100"
                  >
                    <input
                      type="checkbox"
                      data-testid={option.testId}
                      checked={Boolean(newMerchForm.skuTypes[option.value])}
                      onChange={(event) => {
                        setNewMerchSubmitSuccess(null);
                        markFieldTouched('skuTypes');
                        updateNewMerchForm((prev) => ({
                          ...prev,
                          skuTypes: {
                            ...prev.skuTypes,
                            [option.value]: event.target.checked,
                          },
                        }));
                      }}
                      className="h-4 w-4 rounded border-slate-300 dark:border-white/30"
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
              <p className={`text-[11px] ${newMerchTouched.skuTypes && newMerchErrors.skuTypes ? 'text-rose-500 dark:text-rose-300' : 'text-slate-500 dark:text-slate-400'}`}>
                {newMerchTouched.skuTypes && newMerchErrors.skuTypes
                  ? newMerchErrors.skuTypes
                  : 'Required. Select one or more.'}
              </p>
            </div>

            {newMerchSubmitError && (
              <p role="alert" className="rounded-lg border border-rose-300/70 dark:border-rose-500/40 bg-rose-50 dark:bg-rose-500/10 px-3 py-2 text-sm text-rose-600 dark:text-rose-300">
                {newMerchSubmitError}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="submit"
                data-testid="artist-request-merch-submit"
                disabled={newMerchSubmitting}
                className="rounded-full border border-indigo-300 dark:border-indigo-400/40 bg-indigo-50 dark:bg-indigo-500/20 px-4 py-2 text-xs font-bold uppercase tracking-[0.25em] text-indigo-700 dark:text-indigo-100 hover:bg-indigo-100 dark:hover:bg-indigo-500/30 transition-colors disabled:opacity-60"
              >
                {newMerchSubmitting ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          </form>
        )}

        {loading && <p className="text-slate-500 dark:text-slate-400">Loading products...</p>}
        {error && (
          <p role="alert" className="text-sm text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 px-4 py-2 rounded-lg border border-rose-200 dark:border-rose-500/20">
            {error}
          </p>
        )}

        {!loading && !error && (
          <>
            <div className="mt-6 flex justify-center">
              <div className="w-full max-w-[1200px]">
                <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 shadow-lg">
                  <table className="w-full table-fixed text-sm text-slate-900 dark:text-white">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-transparent text-[10px] uppercase tracking-[0.4em] text-slate-500 dark:text-slate-400">
                        <th className="w-[45%] px-6 py-3 text-left">Title</th>
                        <th className="w-[18%] px-6 py-3 text-left">Status</th>
                        <th className="w-[18%] px-6 py-3 text-left">Updated</th>
                        <th className="w-[19%] px-6 py-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                      {visibleProducts.map((product, index) => {
                        const title = product?.title ?? product?.name ?? '-';
                        const story = readProductStory(product) || '-';
                        const designImageUrl = readProductDesignImageUrl(product);
                        const skuTypes = readProductSkuTypes(product);
                        const skuLabel = skuTypes.length
                          ? skuTypes.map((entry) => formatOnboardingSkuTypeLabel(entry)).join(', ')
                          : '-';
                        const productId = getProductId(product) ?? `${title}-${index}`;
                        const status = normalizeProductStatus(product);
                        const active = status === 'active';
                        const rejectionReason = readRejectionReason(product);
                        const pending = Boolean(
                          getProductId(product) && pendingIds[String(getProductId(product))]
                        );
                        const toggleable = isArtistRole && isProductToggleable(product);

                        return (
                          <tr
                            key={productId}
                            data-testid="artist-product-row"
                            className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                          >
                            <td className="w-[45%] px-6 py-4">
                              <div data-testid="artist-merch-readonly-name" className="font-medium">{title}</div>
                              <p data-testid="artist-merch-readonly-story" className="mt-1 line-clamp-2 text-xs text-slate-600 dark:text-slate-300">
                                {story}
                              </p>
                              <p data-testid="artist-merch-readonly-skus" className="mt-1 text-[10px] uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400">
                                SKUs: {skuLabel}
                              </p>
                              <div data-testid="artist-merch-readonly-design-image" className="mt-1 text-[10px] uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400">
                                Design image: {designImageUrl ? 'Uploaded' : 'Not available'}
                              </div>
                              {designImageUrl && (
                                <img
                                  src={designImageUrl}
                                  alt={`${title} design`}
                                  className="mt-2 h-12 w-12 rounded-lg object-cover border border-slate-200 dark:border-white/10"
                                />
                              )}
                            </td>
                            <td className="w-[18%] px-6 py-4">
                              <span
                                data-testid="artist-product-status"
                                className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${getStatusPillClass(status)}`}
                              >
                                {formatStatusLabel(status)}
                              </span>
                              {status === 'rejected' && rejectionReason && (
                                <p data-testid="artist-merch-rejection-reason" className="mt-2 text-[11px] text-rose-600 dark:text-rose-300">
                                  {rejectionReason}
                                </p>
                              )}
                            </td>
                            <td className="w-[18%] px-6 py-4 text-slate-600 dark:text-white/90">
                              {formatUpdatedDate(product)}
                            </td>
                            <td className="w-[19%] px-6 py-4 text-right">
                              {toggleable ? (
                                <button
                                  type="button"
                                  data-testid="artist-merch-status-toggle"
                                  disabled={pending}
                                  className="rounded-full border border-slate-300 dark:border-white/20 bg-white dark:bg-transparent px-3 py-1 text-xs uppercase tracking-[0.3em] text-slate-700 dark:text-white hover:bg-slate-50 dark:hover:bg-white/10 transition-colors disabled:opacity-50"
                                  onClick={() => toggleProductActive(product)}
                                >
                                  {pending ? 'Saving...' : active ? 'Set inactive' : 'Set active'}
                                </button>
                              ) : (
                                <span className="text-[10px] uppercase tracking-[0.25em] text-slate-400 dark:text-slate-500">
                                  {status === 'pending' ? 'Review pending' : 'No action'}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {visibleProducts.length === 0 && (
                  <p className="px-6 py-8 text-center text-slate-500 dark:text-slate-400 italic font-medium">
                    No products for this filter.
                  </p>
                )}
              </div>
            </div>

            <p className="mt-8 flex justify-center">
              <button
                type="button"
                className="group flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                onClick={() => navigate('/partner/artist')}
              >
                <span>{'<-'} Go to dashboard</span>
              </button>
            </p>
          </>
        )}
      </Container>
    </Page>
  );
}
