import React from 'react';
import { normalizePlan } from '../../artistRequests/adminArtistRequestsApi';
import type { ApproveFieldErrors, ArtistRequest, SaveAction } from '../../artistRequests/types';

type AdminArtistRequestReviewModalProps = {
  reviewRequest: ArtistRequest | null;
  finalPlanType: string;
  paymentMode: 'cash' | 'online' | '';
  transactionId: string;
  approvalPassword: string;
  rejectComment: string;
  modalError: string | null;
  approveFieldErrors: ApproveFieldErrors;
  premiumPlanEnabled: boolean;
  savingId: string | null;
  savingAction: SaveAction | null;
  onClose: () => void;
  onFinalPlanTypeChange: (value: string) => void;
  onPaymentModeChange: (value: 'cash' | 'online' | '') => void;
  onTransactionIdChange: (value: string) => void;
  onApprovalPasswordChange: (value: string) => void;
  onRejectCommentChange: (value: string) => void;
  onAction: (request: ArtistRequest, action: SaveAction) => void;
};

export default function AdminArtistRequestReviewModal({
  reviewRequest,
  finalPlanType,
  paymentMode,
  transactionId,
  approvalPassword,
  rejectComment,
  modalError,
  approveFieldErrors,
  premiumPlanEnabled,
  savingId,
  savingAction,
  onClose,
  onFinalPlanTypeChange,
  onPaymentModeChange,
  onTransactionIdChange,
  onApprovalPasswordChange,
  onRejectCommentChange,
  onAction,
}: AdminArtistRequestReviewModalProps) {
  if (!reviewRequest) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-3xl max-h-[90vh] overflow-hidden rounded-[2rem] border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950 shadow-2xl animate-in zoom-in-95 duration-300">
        <div className="flex max-h-[90vh] flex-col">
          <div className="shrink-0 border-b border-slate-100 dark:border-white/10 px-8 pb-6 pt-8 bg-slate-50/50 dark:bg-black/20">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Review Application</h2>
                <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-widest">Processing entry: {reviewRequest.id}</p>
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
          </div>

          <div className="grow overflow-y-auto px-8 pb-8 pr-6 pt-6 custom-scrollbar">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <section>
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-3">Applicant Details</h4>
                  <div className="space-y-4">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Artist Name</span>
                      <span className="text-sm font-bold text-slate-900 dark:text-white">{reviewRequest.artistName || '-'}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Handle</span>
                      <span className="text-sm font-mono text-indigo-600 dark:text-emerald-400">@{reviewRequest.handle || '-'}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Email</span>
                      <span className="text-sm font-medium text-slate-900 dark:text-white">{reviewRequest.email || '-'}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Phone</span>
                      <span className="text-sm font-medium text-slate-900 dark:text-white">{reviewRequest.phone || '-'}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Requested Plan Type</span>
                      <span className="text-xs font-black text-indigo-600 dark:text-emerald-400 uppercase tracking-widest">{(reviewRequest.requestedPlanType || 'basic').toUpperCase()}</span>
                    </div>
                  </div>
                </section>

                <section>
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-3">Social Media</h4>
                  {reviewRequest.socials.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {reviewRequest.socials.map((social, idx) => (
                        <a
                          key={`${reviewRequest.id}-social-${idx}`}
                          href={social.profileLink}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 rounded-lg bg-slate-50 dark:bg-white/5 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/10 transition"
                        >
                          <span className="uppercase opacity-60">{(social.platform || 'Link').substring(0, 2)}</span>
                          {social.platform || 'Visit Profile'}
                        </a>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400 italic">No social links provided.</p>
                  )}
                </section>
              </div>

              <div className="space-y-6">
                <section>
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-3">Profile Photo</h4>
                  {reviewRequest.profilePhotoUrl ? (
                    <div className="group relative aspect-square w-full max-w-[200px] overflow-hidden rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-black/40 shadow-inner">
                      <img
                        src={reviewRequest.profilePhotoUrl}
                        alt={`${reviewRequest.artistName} profile`}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                      />
                      <a
                        href={reviewRequest.profilePhotoUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-white text-[10px] font-bold uppercase tracking-widest"
                      >
                        View Original
                      </a>
                    </div>
                  ) : (
                    <div className="aspect-square w-full max-w-[200px] flex items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-300">
                      No Photo
                    </div>
                  )}
                </section>

                <section className="space-y-4">
                  <div>
                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2">Pitch / About</h4>
                    <div className="rounded-xl bg-slate-50 dark:bg-black/20 p-4 border border-slate-100 dark:border-white/5">
                      <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{reviewRequest.aboutMe || 'No details provided.'}</p>
                    </div>
                  </div>
                  <div>
                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2">Message For Fans</h4>
                    <div className="rounded-xl bg-slate-50 dark:bg-black/20 p-4 border border-slate-100 dark:border-white/5">
                      <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300 italic">"{reviewRequest.messageForFans || 'No message provided.'}"</p>
                    </div>
                  </div>
                </section>
              </div>
            </div>

            <div className="mt-8 space-y-6">
              <div className="rounded-3xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/5 p-6 shadow-sm">
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-6 flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 mr-1"></span>
                  Final Decision and Billing
                </h4>

                <div className="space-y-6">
                  <label className="block">
                    <span className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2 block">
                      Final Approved Plan Type *
                    </span>
                    <div className="relative">
                      <select
                        value={finalPlanType}
                        onChange={(event) => onFinalPlanTypeChange(event.target.value)}
                        disabled={savingId === reviewRequest.id}
                        className="block w-full appearance-none rounded-2xl border border-slate-200 dark:border-white/15 bg-white dark:bg-black/40 px-5 py-3 text-sm font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 dark:focus:ring-emerald-500/20 outline-none transition shadow-inner cursor-pointer"
                      >
                        <option value="basic" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">Basic</option>
                        <option value="advanced" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">Advanced</option>
                        <option value="premium" disabled={!premiumPlanEnabled} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                          {premiumPlanEnabled ? 'Premium' : 'Premium (Coming soon)'}
                        </option>
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-400">
                        <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20">
                          <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                        </svg>
                      </div>
                    </div>
                    {approveFieldErrors.finalPlanType && (
                      <p className="mt-2 text-[10px] font-bold text-rose-600 dark:text-rose-300 uppercase tracking-widest">{approveFieldErrors.finalPlanType}</p>
                    )}
                  </label>

                  {normalizePlan(finalPlanType) === 'basic' ? (
                    <div className="grid gap-6 md:grid-cols-2">
                      <label className="block">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2 block">Payment Mode</span>
                        <input
                          type="text"
                          value="NA"
                          disabled
                          className="block w-full rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-black/30 px-5 py-3 text-sm font-medium text-slate-500 dark:text-white/50 cursor-not-allowed uppercase tracking-widest"
                        />
                      </label>
                      <label className="block">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2 block">Transaction ID</span>
                        <input
                          type="text"
                          value="NA"
                          disabled
                          className="block w-full rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-black/30 px-5 py-3 text-sm font-medium text-slate-500 dark:text-white/50 cursor-not-allowed uppercase tracking-widest"
                        />
                      </label>
                    </div>
                  ) : (
                    <div className="grid gap-6 md:grid-cols-2">
                      <label className="block">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2 block">Payment Mode *</span>
                        <div className="relative">
                          <select
                            value={paymentMode}
                            onChange={(event) => onPaymentModeChange(event.target.value as 'cash' | 'online' | '')}
                            disabled={savingId === reviewRequest.id}
                            className="block w-full appearance-none rounded-2xl border border-slate-200 dark:border-white/15 bg-white dark:bg-black/40 px-5 py-3 text-sm font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 dark:focus:ring-emerald-500/20 outline-none transition shadow-inner cursor-pointer"
                          >
                            <option value="" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">Select mode</option>
                            <option value="cash" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">Cash</option>
                            <option value="online" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">Online</option>
                          </select>
                          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-400">
                            <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20">
                              <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                            </svg>
                          </div>
                        </div>
                        {approveFieldErrors.paymentMode && (
                          <p className="mt-2 text-[10px] font-bold text-rose-600 dark:text-rose-300 uppercase tracking-widest">{approveFieldErrors.paymentMode}</p>
                        )}
                      </label>

                      <label className="block">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2 block">Transaction ID *</span>
                        <input
                          type="text"
                          value={transactionId}
                          onChange={(event) => onTransactionIdChange(event.target.value)}
                          disabled={savingId === reviewRequest.id}
                          className="block w-full rounded-2xl border border-slate-200 dark:border-white/15 bg-white dark:bg-black/40 px-5 py-3 text-sm font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 dark:focus:ring-emerald-500/20 outline-none transition shadow-inner"
                          placeholder="Enter receipt/transaction ref"
                        />
                        {approveFieldErrors.transactionId && (
                          <p className="mt-2 text-[10px] font-bold text-rose-600 dark:text-rose-300 uppercase tracking-widest">{approveFieldErrors.transactionId}</p>
                        )}
                      </label>
                    </div>
                  )}

                  <label className="block">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2 block">
                      Artist Login Password *
                    </span>
                    <input
                      type="password"
                      data-testid="admin-artist-approval-password"
                      value={approvalPassword}
                      onChange={(event) => onApprovalPasswordChange(event.target.value)}
                      disabled={savingId === reviewRequest.id}
                      className="block w-full rounded-2xl border border-slate-200 dark:border-white/15 bg-white dark:bg-black/40 px-5 py-3 text-sm font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 dark:focus:ring-emerald-500/20 outline-none transition shadow-inner"
                      placeholder="Enter artist login password"
                    />
                    <p className="mt-2 text-[10px] text-slate-400 italic">
                      This password will be used by the artist to log in after approval.
                    </p>
                    {approveFieldErrors.approvalPassword && (
                      <p className="mt-2 text-[10px] font-bold text-rose-600 dark:text-rose-300 uppercase tracking-widest">
                        {approveFieldErrors.approvalPassword}
                      </p>
                    )}
                  </label>
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-white/10">
                <label className="block">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2 block">Internal Feedback / Rejection Reason</span>
                  <textarea
                    value={rejectComment}
                    onChange={(event) => onRejectCommentChange(event.target.value)}
                    rows={4}
                    className="block w-full rounded-2xl border border-slate-200 dark:border-white/15 bg-white dark:bg-black/40 px-5 py-3 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 dark:focus:ring-emerald-500/20 outline-none transition shadow-inner"
                    placeholder="If rejecting, please explain why. This note is helpful for future audits."
                  />
                  <p className="mt-2 text-[10px] text-slate-400 italic">This field is mandatory for rejection but optional for approval.</p>
                </label>
              </div>
            </div>
          </div>

          <div className="shrink-0 border-t border-slate-100 dark:border-white/10 px-8 pb-8 pt-6 bg-slate-50/50 dark:bg-black/20">
            {modalError && (
              <div className="mb-4 flex items-center gap-2 rounded-xl border border-rose-200 dark:border-rose-500/20 bg-rose-50 dark:bg-rose-500/10 px-4 py-3 text-xs font-bold text-rose-600 dark:text-rose-300 uppercase tracking-widest">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                {modalError}
              </div>
            )}
            <div className="flex flex-wrap gap-4">
              <button
                type="button"
                onClick={() => onAction(reviewRequest, 'approve')}
                disabled={savingId === reviewRequest.id || reviewRequest.status.toLowerCase() !== 'pending'}
                className="flex-1 rounded-2xl bg-indigo-600 dark:bg-emerald-500 px-8 py-4 text-[10px] font-black uppercase tracking-[0.3em] text-white shadow-xl shadow-indigo-500/20 dark:shadow-emerald-500/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:scale-100"
              >
                {savingId === reviewRequest.id && savingAction === 'approve' ? 'Processing...' : 'Approve Application'}
              </button>
              <button
                type="button"
                onClick={() => onAction(reviewRequest, 'reject')}
                disabled={savingId === reviewRequest.id || reviewRequest.status.toLowerCase() !== 'pending'}
                className="flex-1 rounded-2xl border-2 border-slate-200 dark:border-white/10 bg-white dark:bg-transparent px-8 py-4 text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 dark:text-rose-400 hover:text-slate-900 dark:hover:text-rose-300 hover:border-slate-900 dark:hover:border-rose-500/40 transition-all disabled:opacity-50"
              >
                {savingId === reviewRequest.id && savingAction === 'reject' ? 'Processing...' : 'Reject Application'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
