import React from 'react';
import type { RefObject } from 'react';

import { formatOnboardingSkuTypeLabel } from '../../../../shared/utils/onboardingSkuTypes';
import type { PendingMerchRequest } from '../../pages/AdminProductsPage.utils';
import {
  MARKETPLACE_IMAGE_ACCEPT,
  MAX_MARKETPLACE_IMAGES,
  MIN_MARKETPLACE_IMAGES,
  readPendingSkuTypes,
  readText,
  resolvePendingSubmittedAt,
} from '../../pages/AdminProductsPage.utils';

type Props = {
  isOpen: boolean;
  selectedRequest: PendingMerchRequest | null;
  isLoading: boolean;
  isSubmitting: boolean;
  error: string | null;
  successMessage: string | null;
  artistName: string;
  designPreview: string | null;
  reviewStatus: string;
  reviewRejectionReason: string;
  isMutable: boolean;
  marketplaceFiles: File[];
  marketplaceError: string;
  rejectionReasonDraft: string;
  approveDisabled: boolean;
  approveDisabledReason: string;
  marketplaceInputRef: RefObject<HTMLInputElement>;
  onClose: () => void;
  onMarketplaceFilesChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveMarketplaceImage: (index: number) => void;
  onRejectionReasonChange: (value: string) => void;
  onApprove: () => void;
  onReject: () => void;
};

export default function AdminPendingMerchReviewModal({
  isOpen,
  selectedRequest,
  isLoading,
  isSubmitting,
  error,
  successMessage,
  artistName,
  designPreview,
  reviewStatus,
  reviewRejectionReason,
  isMutable,
  marketplaceFiles,
  marketplaceError,
  rejectionReasonDraft,
  approveDisabled,
  approveDisabledReason,
  marketplaceInputRef,
  onClose,
  onMarketplaceFilesChange,
  onRemoveMarketplaceImage,
  onRejectionReasonChange,
  onApprove,
  onReject,
}: Props) {
  if (!isOpen || !selectedRequest) {
    return null;
  }

  const skuTypes = readPendingSkuTypes(selectedRequest);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div
        data-testid="admin-pending-merch-review-modal"
        data-product-id={selectedRequest.id}
        className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-[2.5rem] border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950 shadow-2xl animate-in zoom-in-95 duration-300 custom-scrollbar flex flex-col"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 dark:border-white/10 bg-white/90 dark:bg-slate-950/90 px-8 py-6 backdrop-blur-sm">
          <div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white">
              Pending Merch Review
            </h2>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Admin Approval Queue
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

        <div className="p-8 space-y-6 flex-1">
          {error && (
            <div className="rounded-2xl bg-rose-50 dark:bg-rose-500/10 p-4 border border-rose-100 dark:border-rose-500/20">
              <p className="text-xs font-bold text-rose-600 dark:text-rose-400 uppercase tracking-widest">
                {error}
              </p>
            </div>
          )}
          {successMessage && (
            <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 p-4 border border-emerald-100 dark:border-emerald-500/20">
              <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-widest">
                {successMessage}
              </p>
            </div>
          )}

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent"></div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                Loading request details...
              </p>
            </div>
          ) : (
            <>
              <div className="grid gap-6 md:grid-cols-[220px_1fr]">
                <div className="space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                    Design Preview
                  </p>
                  <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/20 overflow-hidden aspect-square">
                    {designPreview ? (
                      <img
                        data-testid="admin-pending-merch-design-preview"
                        src={designPreview}
                        alt={selectedRequest.title || 'Design preview'}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div
                        data-testid="admin-pending-merch-design-preview"
                        className="h-full w-full flex items-center justify-center text-[10px] font-bold uppercase tracking-wider text-slate-400"
                      >
                        No preview
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                      Merch Name
                    </p>
                    <p data-testid="admin-pending-merch-name" className="text-lg font-bold text-slate-900 dark:text-white">
                      {selectedRequest.title || selectedRequest.name || 'Untitled merch'}
                    </p>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                        Artist
                      </p>
                      <p data-testid="admin-pending-merch-artist" className="text-sm font-medium text-slate-700 dark:text-slate-200">
                        {artistName}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                        Submitted At
                      </p>
                      <p data-testid="admin-pending-merch-submitted-at" className="text-sm font-medium text-slate-700 dark:text-slate-200">
                        {resolvePendingSubmittedAt(selectedRequest)}
                      </p>
                    </div>
                    <div className="sm:col-span-2">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                        Current Status
                      </p>
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                        {reviewStatus}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                  Selected SKU Types
                </p>
                <div data-testid="admin-pending-merch-skus" className="flex flex-wrap gap-2">
                  {skuTypes.length > 0 ? (
                    <>
                      <span className="sr-only">
                        {skuTypes.map((entry) => formatOnboardingSkuTypeLabel(entry)).join(', ')}
                      </span>
                      {skuTypes.map((skuType, index) => (
                        <span
                          key={`pending-sku-${skuType}-${index}`}
                          className="rounded-full border border-slate-200 dark:border-white/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-slate-600 dark:text-slate-300"
                        >
                          {formatOnboardingSkuTypeLabel(skuType)}
                        </span>
                      ))}
                    </>
                  ) : (
                    <span className="text-[10px] uppercase tracking-widest text-slate-400">
                      No SKU types
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                  Merch Story
                </p>
                <p
                  data-testid="admin-pending-merch-story"
                  className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/20 p-4 text-sm leading-relaxed text-slate-700 dark:text-slate-200 whitespace-pre-wrap"
                >
                  {readText(selectedRequest.description) || readText(selectedRequest.merchStory) || '-'}
                </p>
                {reviewStatus === 'rejected' && reviewRejectionReason && (
                  <p
                    data-testid="admin-pending-merch-rejection-reason"
                    className="rounded-2xl border border-rose-200 dark:border-rose-500/30 bg-rose-50/70 dark:bg-rose-500/10 p-3 text-xs font-medium text-rose-700 dark:text-rose-200 whitespace-pre-wrap"
                  >
                    Rejection reason: {reviewRejectionReason}
                  </p>
                )}
              </div>

              <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/20 p-4 space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                  Marketplace Listing Images (JPG/PNG)
                </p>
                <input
                  ref={marketplaceInputRef}
                  data-testid="admin-marketplace-images-input"
                  type="file"
                  multiple
                  accept={MARKETPLACE_IMAGE_ACCEPT}
                  onChange={onMarketplaceFilesChange}
                  className="block w-full text-sm text-slate-700 dark:text-slate-200 file:mr-3 file:rounded-full file:border file:border-slate-200 dark:file:border-white/10 file:bg-white dark:file:bg-black/20 file:px-4 file:py-2 file:text-[10px] file:font-black file:uppercase file:tracking-widest"
                />
                <p data-testid="admin-marketplace-image-count" className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {marketplaceFiles.length} selected (required {MIN_MARKETPLACE_IMAGES}-{MAX_MARKETPLACE_IMAGES})
                </p>
                <ul data-testid="admin-marketplace-upload-list" className="space-y-1">
                  {marketplaceFiles.length > 0 ? (
                    marketplaceFiles.map((file, index) => (
                      <li
                        key={`${file.name}-${file.lastModified}-${index}`}
                        className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-black/30 px-3 py-2"
                      >
                        <span className="truncate text-[10px] font-bold uppercase tracking-widest text-slate-600 dark:text-slate-300">
                          {file.name}
                        </span>
                        <button
                          type="button"
                          data-testid="admin-marketplace-image-remove"
                          onClick={() => onRemoveMarketplaceImage(index)}
                          disabled={isSubmitting}
                          className="rounded-full border border-slate-200 dark:border-white/10 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-300 disabled:opacity-50"
                        >
                          Remove
                        </button>
                      </li>
                    ))
                  ) : (
                    <li className="text-[10px] uppercase tracking-widest text-slate-400">
                      No images selected
                    </li>
                  )}
                </ul>
                {marketplaceError && (
                  <p data-testid="admin-marketplace-upload-error" className="text-[10px] font-bold uppercase tracking-widest text-rose-600 dark:text-rose-300">
                    {marketplaceError}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                  Rejection Reason (optional)
                </p>
                <textarea
                  data-testid="admin-rejection-reason"
                  value={rejectionReasonDraft}
                  onChange={(event) => onRejectionReasonChange(event.target.value)}
                  readOnly={!isMutable}
                  rows={3}
                  className="block w-full rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-black/20 px-4 py-3 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 outline-none transition shadow-inner"
                  placeholder={
                    isMutable
                      ? 'Optional note to include when rejecting this request.'
                      : 'Saved rejection reason'
                  }
                />
              </div>
            </>
          )}
        </div>

        <div className="sticky bottom-0 bg-white/90 dark:bg-slate-950/90 border-t border-slate-100 dark:border-white/10 p-8 flex flex-wrap gap-3 backdrop-blur-sm">
          <button
            type="button"
            data-testid="admin-approve-merch"
            onClick={onApprove}
            disabled={approveDisabled}
            className="rounded-[1.25rem] bg-emerald-600 py-3 px-6 text-[10px] font-black uppercase tracking-[0.3em] text-white shadow-xl transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:scale-100"
          >
            {isSubmitting ? 'Processing...' : 'Approve'}
          </button>
          {approveDisabledReason && (
            <p data-testid="admin-approve-disabled-reason" className="self-center text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-300">
              {approveDisabledReason}
            </p>
          )}
          <button
            type="button"
            data-testid="admin-reject-merch"
            onClick={onReject}
            disabled={!isMutable || isLoading || isSubmitting}
            className="rounded-[1.25rem] bg-rose-600 py-3 px-6 text-[10px] font-black uppercase tracking-[0.3em] text-white shadow-xl transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:scale-100"
          >
            {isSubmitting ? 'Processing...' : 'Reject'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-[1.25rem] border-2 border-slate-200 dark:border-white/10 bg-white dark:bg-transparent px-8 py-3 text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white hover:border-slate-900 dark:hover:border-white/20 transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
