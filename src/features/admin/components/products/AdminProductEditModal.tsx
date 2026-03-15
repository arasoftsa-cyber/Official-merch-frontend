import React from 'react';
import type { RefObject } from 'react';

import type {
  FieldErrors,
  Product,
  ProductEditFormValues,
} from '../../pages/AdminProductsPage.utils';
import { LISTING_PHOTO_ACCEPT, MAX_LISTING_PHOTOS } from '../../pages/AdminProductsPage.utils';

type Props = {
  isOpen: boolean;
  selectedProduct: Product | null;
  isLoading: boolean;
  isSubmitting: boolean;
  error: string | null;
  initialValues: ProductEditFormValues | null;
  values: ProductEditFormValues;
  visibleListingPhotoUrls: string[];
  replacementPhotos: File[];
  fieldErrors: FieldErrors;
  photoFieldError: string;
  photoNotice: string | null;
  saveDisabled: boolean;
  artistLabelById: Record<string, string>;
  photoInputRef: RefObject<HTMLInputElement>;
  headingRef: RefObject<HTMLHeadingElement>;
  onClose: () => void;
  onSubmit: () => void;
  onOpenPhotoPicker: () => void;
  onReplacementPhotosChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onMarkInteraction: () => void;
  onTitleChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onActiveChange: (value: boolean) => void;
};

export default function AdminProductEditModal({
  isOpen,
  selectedProduct,
  isLoading,
  isSubmitting,
  error,
  initialValues,
  values,
  visibleListingPhotoUrls,
  replacementPhotos,
  fieldErrors,
  photoFieldError,
  photoNotice,
  saveDisabled,
  artistLabelById,
  photoInputRef,
  headingRef,
  onClose,
  onSubmit,
  onOpenPhotoPicker,
  onReplacementPhotosChange,
  onMarkInteraction,
  onTitleChange,
  onDescriptionChange,
  onActiveChange,
}: Props) {
  if (!isOpen || !selectedProduct) {
    return null;
  }

  const photoHelperId = 'admin-edit-product-photo-helper';
  const photoErrorId = 'admin-edit-product-photo-error';
  const photoDescribedBy =
    photoNotice && !photoFieldError ? `${photoHelperId} ${photoErrorId}` : photoHelperId;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div
        data-testid="admin-product-edit-modal"
        data-product-id={selectedProduct.id}
        aria-labelledby="admin-product-edit-modal-heading"
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[2.5rem] border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950 shadow-2xl animate-in zoom-in-95 duration-300 custom-scrollbar flex flex-col"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 dark:border-white/10 bg-white/90 dark:bg-slate-950/90 px-8 py-6 backdrop-blur-sm">
          <div>
            <h2
              ref={headingRef}
              id="admin-product-edit-modal-heading"
              data-testid="admin-product-edit-modal-heading"
              className="text-2xl font-black text-slate-900 dark:text-white"
            >
              Edit Product
            </h2>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Settings & Details
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white transition shadow-sm"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-8 space-y-8 flex-1">
          {error && (
            <div className="rounded-2xl bg-rose-50 dark:bg-rose-500/10 p-4 border border-rose-100 dark:border-rose-500/20">
              <p className="text-xs font-bold text-rose-600 dark:text-rose-400 uppercase tracking-widest">
                {error}
              </p>
            </div>
          )}

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent"></div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                Fetching Matrix...
              </p>
            </div>
          ) : (
            <>
              <div className="grid gap-6 md:grid-cols-2">
                <label className="block space-y-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                    Artist
                  </span>
                  <input
                    data-testid="admin-edit-product-artist"
                    value={artistLabelById[values.artistId] || values.artistId || '-'}
                    readOnly
                    disabled
                    className="block w-full rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/40 px-5 py-3 text-sm font-medium text-slate-400 dark:text-white/40 cursor-not-allowed uppercase tracking-widest shadow-inner"
                  />
                </label>

                <label className="block space-y-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                    Merch Name *
                  </span>
                  <input
                    data-testid="admin-edit-product-merch-name"
                    value={values.title}
                    onChange={(event) => {
                      onMarkInteraction();
                      onTitleChange(event.target.value);
                    }}
                    className="block w-full rounded-2xl border border-slate-200 dark:border-white/15 bg-white dark:bg-black/20 px-5 py-3 text-sm font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 outline-none transition shadow-inner"
                  />
                  {fieldErrors.title && (
                    <p className="text-[10px] text-rose-500 font-bold uppercase">{fieldErrors.title}</p>
                  )}
                </label>

                <label className="block space-y-2 md:col-span-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                    Description *
                  </span>
                  <textarea
                    data-testid="admin-edit-product-story"
                    value={values.description}
                    onChange={(event) => {
                      onMarkInteraction();
                      onDescriptionChange(event.target.value);
                    }}
                    rows={4}
                    className="block w-full rounded-2xl border border-slate-200 dark:border-white/15 bg-white dark:bg-black/20 px-5 py-4 text-sm leading-relaxed text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 outline-none transition shadow-inner"
                  />
                  {fieldErrors.merch_story && (
                    <p className="text-[10px] text-rose-500 font-bold uppercase">
                      {fieldErrors.merch_story}
                    </p>
                  )}
                </label>

                <div className="flex items-center gap-6 md:col-span-2">
                  <label className="relative flex cursor-pointer items-center gap-3">
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={values.isActive}
                        onChange={(event) => {
                          onMarkInteraction();
                          onActiveChange(event.target.checked);
                        }}
                        className="peer sr-only"
                      />
                      <div className="h-6 w-11 rounded-full bg-slate-200 dark:bg-white/10 peer-checked:bg-emerald-500 transition-colors"></div>
                      <div className="absolute left-1 top-1 h-4 w-4 rounded-full bg-white transition-transform peer-checked:translate-x-5"></div>
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                      Active Status
                    </span>
                  </label>
                  {initialValues && (
                    <span
                      data-testid="admin-edit-product-initial-title"
                      className="sr-only"
                    >
                      {initialValues.title}
                    </span>
                  )}
                </div>
              </div>

              <fieldset
                className={`rounded-3xl border p-6 bg-slate-50/50 dark:bg-black/20 ${
                  photoFieldError
                    ? 'border-rose-300 dark:border-rose-500/40'
                    : 'border-slate-200 dark:border-white/10'
                }`}
              >
                <legend className="px-3 text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Visual Assets (4 Required)
                </legend>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  {Array.from({ length: MAX_LISTING_PHOTOS }).map((_, index) => {
                    const src = visibleListingPhotoUrls[index];
                    return (
                      <div
                        key={index}
                        data-testid={`admin-edit-product-photo-slot-${index + 1}`}
                        className="aspect-square rounded-2xl border-2 border-slate-200 dark:border-white/10 bg-white dark:bg-black/40 overflow-hidden"
                      >
                        {src ? (
                          <img
                            data-testid="admin-edit-product-photo-preview"
                            src={src}
                            alt={`Product preview ${index + 1}`}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center text-[10px] text-slate-300 font-black">
                            SLOT {index + 1}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <button
                  type="button"
                  data-testid="admin-edit-product-photo-trigger"
                  onClick={onOpenPhotoPicker}
                  disabled={isSubmitting || isLoading}
                  aria-describedby={photoDescribedBy}
                  aria-invalid={Boolean(photoFieldError)}
                  className="mt-8 group relative flex w-full flex-col items-center justify-center rounded-[2rem] border-2 border-dashed border-slate-300 dark:border-white/10 py-10 hover:border-indigo-500 transition-all text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <div className="text-center space-y-2">
                    <p className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest">
                      Replace All Photos
                    </p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">
                      {replacementPhotos.length > 0
                        ? `${replacementPhotos.length} / ${MAX_LISTING_PHOTOS} selected`
                        : 'PNG / JPG / WEBP'}
                    </p>
                  </div>
                </button>
                <input
                  ref={photoInputRef}
                  id="admin-edit-product-photo-input"
                  data-testid="admin-edit-product-photo-input"
                  type="file"
                  multiple
                  accept={LISTING_PHOTO_ACCEPT}
                  className="sr-only"
                  onChange={onReplacementPhotosChange}
                  aria-describedby={photoDescribedBy}
                  aria-invalid={Boolean(photoFieldError)}
                />
                <p
                  id={photoHelperId}
                  className={`mt-3 text-[10px] font-bold uppercase tracking-wider ${
                    photoFieldError
                      ? 'text-rose-500 dark:text-rose-400'
                      : 'text-slate-400 dark:text-slate-500'
                  }`}
                >
                  {photoFieldError
                    ? photoFieldError
                    : 'Upload up to 4 product images (PNG, JPG, or WEBP).'}
                </p>
                {photoNotice && !photoFieldError && (
                  <p
                    id={photoErrorId}
                    className="mt-1 text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400"
                  >
                    {photoNotice}
                  </p>
                )}
              </fieldset>
            </>
          )}
        </div>

        <div className="sticky bottom-0 bg-white/90 dark:bg-slate-950/90 border-t border-slate-100 dark:border-white/10 p-8 flex gap-4 backdrop-blur-sm">
          <button
            data-testid="admin-edit-product-save"
            type="button"
            onClick={onSubmit}
            disabled={saveDisabled}
            className="flex-1 rounded-[1.25rem] bg-slate-900 dark:bg-white py-4 text-[10px] font-black uppercase tracking-[0.3em] text-white dark:text-slate-950 shadow-2xl transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:scale-100"
          >
            {isSubmitting ? 'Saving changes...' : 'Commit Changes'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-[1.25rem] border-2 border-slate-200 dark:border-white/10 bg-white dark:bg-transparent px-8 py-4 text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white hover:border-slate-900 dark:hover:border-white/20 transition-all"
          >
            Discard
          </button>
        </div>
      </div>
    </div>
  );
}
