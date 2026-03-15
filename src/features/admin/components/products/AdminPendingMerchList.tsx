import React from 'react';
import { formatOnboardingSkuTypeLabel } from '../../../../shared/utils/onboardingSkuTypes';
import { resolveMediaUrl } from '../../../../shared/utils/media';
import type { PendingMerchRequest } from '../../pages/AdminProductsPage.utils';
import {
  normalizeStatus,
  readPendingSkuTypes,
  readText,
  resolvePendingSubmittedAt,
} from '../../pages/AdminProductsPage.utils';

type Props = {
  loading: boolean;
  pendingRequests: PendingMerchRequest[];
  artistLabelById: Record<string, string>;
  onOpenPendingModal: (request: PendingMerchRequest) => void;
};

export default function AdminPendingMerchList({
  loading,
  pendingRequests,
  artistLabelById,
  onOpenPendingModal,
}: Props) {
  return (
    <div className="rounded-[2rem] border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 p-6 space-y-4 shadow-2xl shadow-slate-200/50 dark:shadow-none">
      {loading ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">Loading pending requests...</p>
      ) : pendingRequests.length === 0 ? (
        <p className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/20 px-4 py-6 text-center text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          No pending or rejected merchandise requests.
        </p>
      ) : (
        <div className="space-y-3">
          {pendingRequests.map((request) => {
            const requestId = String(request.id || request.productId || '').trim();
            const statusLabel = normalizeStatus(request.status || 'pending') || 'pending';
            const isRejected = statusLabel === 'rejected';
            const artistId = String(request.artistId || '').trim();
            const artistLabel =
              readText(request.artistName) ||
              readText(request.artistHandle) ||
              artistLabelById[artistId] ||
              'Unknown Artist';
            const rejectionReason = readText(request.rejectionReason);
            const skuTypes = readPendingSkuTypes(request);
            const designImage = resolveMediaUrl(request.designImageUrl || null);

            return (
              <article
                key={requestId || `${request.title || 'pending'}-${request.createdAt || ''}`}
                data-testid="admin-pending-merch-row"
                className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-black/20 p-4"
              >
                <div className="grid gap-4 md:grid-cols-[160px_1fr_auto]">
                  <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/20 overflow-hidden h-32">
                    {designImage ? (
                      <img
                        src={designImage}
                        alt={request.title || 'Design preview'}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        No design
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-black text-slate-900 dark:text-white">
                      {request.title || request.name || 'Untitled merch'}
                    </p>
                    <p className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Artist: {artistLabel}
                    </p>
                    <p className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Submitted: {resolvePendingSubmittedAt(request)}
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2">
                      {readText(request.description) || readText(request.merchStory) || '-'}
                    </p>
                    {isRejected && rejectionReason && (
                      <p
                        data-testid="admin-pending-merch-rejection-reason"
                        className="text-xs text-rose-600 dark:text-rose-300 line-clamp-2"
                      >
                        Rejection reason: {rejectionReason}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2">
                      {skuTypes.length > 0 ? (
                        <>
                          <span className="sr-only">
                            {skuTypes.map((entry) => formatOnboardingSkuTypeLabel(entry)).join(', ')}
                          </span>
                          {skuTypes.map((skuType, index) => (
                            <span
                              key={`${requestId}-${skuType}-${index}`}
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
                  <div className="flex flex-col items-end gap-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest ring-1 ring-inset ${
                        isRejected
                          ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300 ring-rose-500/20'
                          : 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 ring-amber-500/20'
                      }`}
                    >
                      {statusLabel}
                    </span>
                    <button
                      type="button"
                      data-testid="admin-pending-merch-open"
                      onClick={() => onOpenPendingModal(request)}
                      className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300 hover:bg-slate-900 dark:hover:bg-white hover:text-white dark:hover:text-slate-950 transition-all shadow-sm"
                    >
                      View Details
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
