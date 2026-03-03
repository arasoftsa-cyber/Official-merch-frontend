import React, { useCallback, useEffect, useState } from 'react';
import ErrorBanner from '../../components/ux/ErrorBanner';
import LoadingSkeleton from '../../components/ux/LoadingSkeleton';
import { useToast } from '../../components/ux/ToastHost';
import { apiFetch } from '../../shared/api/http';
import { getAccessToken } from '../../shared/auth/tokenStore';
import { resolveMediaUrl } from '../../shared/utils/media';
import { Container, Page } from '../../ui/Page';

const endpoint = '/api/admin/artist-access-requests';
const STATUS_OPTIONS = ['pending', 'approved', 'rejected'] as const;
const STATUS_LABELS: Record<(typeof STATUS_OPTIONS)[number], string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
};
const LIMIT = 20;

type SocialItem = {
  platform: string;
  profileLink: string;
};

type ArtistRequest = {
  id: string;
  createdAt: string;
  status: string;
  source: string;
  labelId?: string | null;
  artistName: string;
  handle: string;
  email: string;
  phone: string;
  socials: SocialItem[];
  aboutMe: string;
  profilePhotoUrl: string;
  messageForFans: string;
  requestedPlanType: string;
  rejectionComment: string;
};

type ApproveFieldErrors = {
  finalPlanType?: string;
  paymentMode?: string;
  transactionId?: string;
};

const formatStatus = (status?: string) => (status ? status.toUpperCase() : 'PENDING');

const normalizeSocials = (value: any): SocialItem[] => {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value
      .map((item) => ({
        platform: String(item?.platform ?? item?.name ?? '').trim(),
        profileLink: String(item?.profileLink ?? item?.url ?? item?.link ?? item?.value ?? '').trim(),
      }))
      .filter((item) => item.platform || item.profileLink);
  }

  if (typeof value === 'string') {
    try {
      return normalizeSocials(JSON.parse(value));
    } catch {
      const raw = value.trim();
      return raw ? [{ platform: '', profileLink: raw }] : [];
    }
  }

  if (typeof value === 'object') {
    return Object.entries(value)
      .map(([platform, profileLink]) => ({
        platform: String(platform || '').trim(),
        profileLink: String(profileLink || '').trim(),
      }))
      .filter((item) => item.platform || item.profileLink);
  }

  return [];
};

const normalizePlanType = (value: unknown) => String(value ?? '').trim().toLowerCase();

const isPremiumEnabledFromConfig = (payload: any): boolean => {
  if (!payload || typeof payload !== 'object') return false;
  if (typeof payload.premium_plan_enabled === 'boolean') return payload.premium_plan_enabled;
  if (typeof payload.premiumPlanEnabled === 'boolean') return payload.premiumPlanEnabled;
  if (Array.isArray(payload.enabled_plan_types)) {
    return payload.enabled_plan_types.map(normalizePlanType).includes('premium');
  }
  if (Array.isArray(payload.enabledPlans)) {
    return payload.enabledPlans.map(normalizePlanType).includes('premium');
  }
  return false;
};

export default function AdminArtistRequests() {
  const token = getAccessToken();
  const { notify } = useToast();
  const [requests, setRequests] = useState<ArtistRequest[]>([]);
  const [total, setTotal] = useState(0);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savingAction, setSavingAction] = useState<'approve' | 'reject' | null>(null);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_OPTIONS)[number]>('pending');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviewRequest, setReviewRequest] = useState<ArtistRequest | null>(null);
  const [rejectComment, setRejectComment] = useState('');
  const [modalError, setModalError] = useState<string | null>(null);
  const [finalPlanType, setFinalPlanType] = useState<'basic' | 'advanced' | 'premium'>('basic');
  const [paymentMode, setPaymentMode] = useState<'cash' | 'online' | ''>('');
  const [transactionId, setTransactionId] = useState('');
  const [approveFieldErrors, setApproveFieldErrors] = useState<ApproveFieldErrors>({});
  const [premiumPlanEnabled, setPremiumPlanEnabled] = useState(false);

  const pageSize = LIMIT;
  const offset = (page - 1) * pageSize;

  const buildUrl = useCallback(() => {
    const params = new URLSearchParams();
    params.set('pageSize', LIMIT.toString());
    params.set('page', page.toString());
    if (statusFilter) params.set('status', statusFilter);
    return `${endpoint}?${params.toString()}`;
  }, [page, statusFilter]);

  const loadRequests = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const payload = await apiFetch(buildUrl());
      let items: any[] = [];
      let totalCount = 0;
      let pageFromPayload = page;
      if (Array.isArray(payload)) {
        items = payload;
        totalCount = payload.length;
      } else {
        items = payload?.items ?? [];
        totalCount = payload?.total ?? items.length;
        pageFromPayload = Number(payload?.page) || page;
      }

      const normalized: ArtistRequest[] = items.map((item) => {
        const artistName =
          String((item as any).artist_name ?? item.artistName ?? item.name ?? 'Unknown').trim() ||
          'Unknown';
        const handle =
          String((item as any).handle ?? (item as any).handle_suggestion ?? item.handleSuggestion ?? '')
            .trim();
        const email =
          String((item as any).email ?? (item as any).contact_email ?? item.contactEmail ?? '').trim();
        const phone =
          String((item as any).phone ?? (item as any).contact_phone ?? item.contactPhone ?? '').trim();
        const createdAt =
          String((item as any).created_at ?? item.createdAt ?? new Date().toISOString()).trim();

        return {
          id: String(item.id),
          createdAt,
          status: String(item.status ?? 'pending'),
          source: String(item.source ?? 'artist_access_request'),
          labelId: (item as any).label_id ?? item.labelId ?? null,
          artistName,
          handle,
          email,
          phone,
          socials: normalizeSocials((item as any).socials ?? item.socials),
          aboutMe: String((item as any).about_me ?? item.aboutMe ?? (item as any).pitch ?? '').trim(),
          profilePhotoUrl:
            resolveMediaUrl(
              String(
                (item as any).profile_photo_url ??
                  (item as any).profile_photo_path ??
                  item.profilePhotoUrl ??
                  item.profilePhotoPath ??
                  ''
              ).trim() || null
            ) ?? '',
          messageForFans: String(
            (item as any).message_for_fans ?? item.messageForFans ?? (item as any).fan_message ?? ''
          ).trim(),
          requestedPlanType: normalizePlanType(
            (item as any).requested_plan_type ?? item.requestedPlanType ?? 'basic'
          ),
          rejectionComment: String(
            (item as any).rejection_comment ?? item.rejectionComment ?? ''
          ).trim(),
        };
      });

      setRequests(normalized);
      setTotal(totalCount);
      setPage(pageFromPayload);
    } catch (err: any) {
      const message =
        err?.error === 'internal_server_error'
          ? 'Unable to load artist requests'
          : err?.message ?? 'Unable to load artist requests';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [buildUrl, page, token]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  useEffect(() => {
    if (!token) {
      setPremiumPlanEnabled(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const payload = await apiFetch('/config');
        if (!cancelled) {
          setPremiumPlanEnabled(isPremiumEnabledFromConfig(payload));
        }
      } catch {
        if (!cancelled) {
          setPremiumPlanEnabled(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (!reviewRequest) return;
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, [reviewRequest]);

  const openReview = (request: ArtistRequest) => {
    const requested = normalizePlanType(request.requestedPlanType);
    const defaultPlan: 'basic' | 'advanced' | 'premium' =
      requested === 'advanced'
        ? 'advanced'
        : requested === 'premium' && premiumPlanEnabled
        ? 'premium'
        : 'basic';
    setReviewRequest(request);
    setFinalPlanType(defaultPlan);
    setPaymentMode('');
    setTransactionId('');
    setApproveFieldErrors({});
    setRejectComment('');
    setModalError(null);
  };

  const closeReview = () => {
    setReviewRequest(null);
    setFinalPlanType('basic');
    setPaymentMode('');
    setTransactionId('');
    setApproveFieldErrors({});
    setRejectComment('');
    setModalError(null);
  };

  const performAction = useCallback(
    async (request: ArtistRequest, action: 'approve' | 'reject') => {
      if (!request?.id) return;
      const trimmedComment = rejectComment.trim();
      if (action === 'reject' && !trimmedComment) {
        setModalError('Rejection comment is required.');
        return;
      }

      if (action === 'approve') {
        const nextFieldErrors: ApproveFieldErrors = {};
        if (!finalPlanType) {
          nextFieldErrors.finalPlanType = 'Final Approved Plan Type is required.';
        }
        if (finalPlanType === 'premium' && !premiumPlanEnabled) {
          nextFieldErrors.finalPlanType = 'Premium plan is not enabled.';
        }
        if (finalPlanType === 'advanced' || finalPlanType === 'premium') {
          if (!paymentMode) {
            nextFieldErrors.paymentMode = 'Payment Mode is required.';
          }
          if (!transactionId.trim()) {
            nextFieldErrors.transactionId = 'Transaction ID is required.';
          }
        }
        if (Object.keys(nextFieldErrors).length > 0) {
          setApproveFieldErrors(nextFieldErrors);
          setModalError('Please fix the approval fields.');
          return;
        }
      }

      setSavingId(request.id);
      setSavingAction(action);
      setApproveFieldErrors({});
      setModalError(null);

      try {
        const approvalBody =
          action === 'approve'
            ? {
                final_plan_type: finalPlanType,
                payment_mode: finalPlanType === 'basic' ? 'NA' : paymentMode,
                transaction_id: finalPlanType === 'basic' ? 'NA' : transactionId.trim(),
              }
            : undefined;

        await apiFetch(`${endpoint}/${request.id}/${action}`, {
          method: 'POST',
          ...(action === 'reject'
            ? { body: { comment: trimmedComment } }
            : { body: approvalBody }),
        });

        notify(
          action === 'approve'
            ? 'Artist request approved successfully.'
            : 'Artist request rejected successfully.',
          'success'
        );

        await loadRequests();
        closeReview();
      } catch (err: any) {
        if (action === 'approve' && Number(err?.status) === 400) {
          const message = String(
            err?.payload?.message ?? err?.message ?? 'Approval validation failed'
          );
          const lower = message.toLowerCase();
          const nextFieldErrors: ApproveFieldErrors = {};
          if (lower.includes('final_plan_type')) {
            nextFieldErrors.finalPlanType = message;
          }
          if (lower.includes('payment_mode')) {
            nextFieldErrors.paymentMode = message;
          }
          if (lower.includes('transaction_id')) {
            nextFieldErrors.transactionId = message;
          }
          setApproveFieldErrors(nextFieldErrors);
          setModalError(message);
        } else {
          setModalError(err?.message ?? 'Action failed');
        }
      } finally {
        setSavingId(null);
        setSavingAction(null);
      }
    },
    [
      finalPlanType,
      loadRequests,
      notify,
      paymentMode,
      premiumPlanEnabled,
      rejectComment,
      transactionId,
    ]
  );

  if (!token) {
    return (
      <Page>
        <Container className="space-y-3">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Admin</p>
            <h1 className="text-3xl font-semibold text-white">Artist Requests</h1>
          </div>
          <p>Authentication required.</p>
        </Container>
      </Page>
    );
  }

  if (loading) {
    return (
      <Page>
        <Container className="space-y-3">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Admin</p>
            <h1 className="text-3xl font-semibold text-white">Artist Requests</h1>
          </div>
          <LoadingSkeleton count={3} />
        </Container>
      </Page>
    );
  }

  return (
    <Page>
      <Container className="space-y-6">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Admin</p>
          <h1 className="text-3xl font-semibold text-white">Artist Requests</h1>
          <p className="text-xs text-white/60">Manage incoming artist applications.</p>
        </div>

        <div className="flex items-center gap-3">
          <label className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400" htmlFor="status-filter">
            Filter
          </label>
          <select
            id="status-filter"
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value as (typeof STATUS_OPTIONS)[number]);
              setPage(1);
            }}
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white focus:border-white/30 focus:outline-none"
          >
            {STATUS_OPTIONS.map((status) => (
              <option key={status} value={status} className="bg-slate-900">
                {STATUS_LABELS[status]}
              </option>
            ))}
          </select>
          <span className="text-xs text-white/60">
            Showing {requests.length} of {total}
          </span>
        </div>

        {error && <ErrorBanner message={error} onRetry={loadRequests} />}

        {requests.length === 0 ? (
          <p className="text-sm text-white/60">No pending artist requests</p>
        ) : (
          <div className="space-y-4">
            {requests.map((request) => (
              <div
                key={request.id}
                className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-sm"
              >
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-white/50">{request.source}</p>
                    <p className="text-lg font-semibold text-white">{request.artistName}</p>
                    {request.handle && <p className="text-xs text-white/60">@{request.handle}</p>}
                    <p className="text-xs text-white/60">{request.email || request.phone || 'No contact info'}</p>
                    <p className="text-xs text-white/60">
                      Requested Plan:{' '}
                      <span className="font-semibold text-white/80">
                        {request.requestedPlanType ? request.requestedPlanType.toUpperCase() : 'BASIC'}
                      </span>
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2 text-[11px] uppercase tracking-[0.3em] text-white/60">
                    <span>{formatStatus(request.status)}</span>
                    <span>Submitted {new Date(request.createdAt).toLocaleString()}</span>
                    <button
                      type="button"
                      onClick={() => openReview(request)}
                      className="inline-flex items-center rounded-full border border-white/20 bg-white/5 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.3em] text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
                    >
                      Review
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between text-xs text-white/60">
          <button
            type="button"
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            disabled={page === 1}
            className="rounded-full border border-white/10 px-3 py-1 uppercase tracking-[0.3em] disabled:opacity-40"
          >
            Prev
          </button>
          <button
            type="button"
            onClick={() => setPage((prev) => prev + 1)}
            disabled={offset + pageSize >= total}
            className="rounded-full border border-white/10 px-3 py-1 uppercase tracking-[0.3em] disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </Container>

      {reviewRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-3xl max-h-[85vh] overflow-hidden rounded-2xl border border-white/10 bg-slate-950 shadow-2xl">
            <div className="flex max-h-[85vh] flex-col">
              <div className="shrink-0 border-b border-white/10 px-5 pb-4 pt-5">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-white">Review Artist Request</h2>
                  <button
                    type="button"
                    onClick={closeReview}
                    className="rounded-full border border-white/20 px-3 py-1 text-xs uppercase tracking-[0.3em] text-white/80 hover:bg-white/10"
                  >
                    Close
                  </button>
                </div>
              </div>

              <div className="grow overflow-y-auto px-5 pb-4 pr-4 pt-4">
                <div className="space-y-3 text-sm text-white/85">
                  <p><span className="text-white/60">Artist Name:</span> {reviewRequest.artistName || '—'}</p>
                  <p><span className="text-white/60">Handle:</span> {reviewRequest.handle || '—'}</p>
                  <p><span className="text-white/60">Email:</span> {reviewRequest.email || '—'}</p>
                  <p><span className="text-white/60">Phone:</span> {reviewRequest.phone || '—'}</p>
                  <p>
                    <span className="text-white/60">Requested Plan Type:</span>{' '}
                    {(reviewRequest.requestedPlanType || 'basic').toUpperCase()}
                  </p>
                  <div>
                    <p className="text-white/60">Socials:</p>
                    {reviewRequest.socials.length > 0 ? (
                      <ul className="mt-1 list-disc space-y-1 pl-5">
                        {reviewRequest.socials.map((social, idx) => (
                          <li key={`${reviewRequest.id}-social-${idx}`}>
                            {(social.platform || 'platform').toUpperCase()}: {social.profileLink || '—'}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-1 text-white/70">—</p>
                    )}
                  </div>
                  <p><span className="text-white/60">About Me:</span> {reviewRequest.aboutMe || '—'}</p>
                  <div>
                    <p className="text-white/60">Profile Photo:</p>
                    {reviewRequest.profilePhotoUrl ? (
                      <div className="mt-2 space-y-2">
                        <a
                          href={reviewRequest.profilePhotoUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-emerald-300 underline"
                        >
                          Open profile photo
                        </a>
                        <img
                          src={reviewRequest.profilePhotoUrl}
                          alt={`${reviewRequest.artistName} profile`}
                          className="max-h-48 rounded-lg border border-white/10 object-contain"
                        />
                      </div>
                    ) : (
                      <p className="mt-1 text-white/70">—</p>
                    )}
                  </div>
                  <p><span className="text-white/60">Message For Fans:</span> {reviewRequest.messageForFans || '—'}</p>
                </div>

                <div className="mt-4 space-y-3">
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <p className="text-xs uppercase tracking-[0.3em] text-white/60">Approval</p>

                    <label className="mt-3 block text-sm font-medium text-white/80">
                      Final Approved Plan Type *
                      <select
                        value={finalPlanType}
                        onChange={(event) => {
                          const next = event.target.value as 'basic' | 'advanced' | 'premium';
                          setFinalPlanType(next);
                          setModalError(null);
                          setApproveFieldErrors((prev) => {
                            const updated = { ...prev };
                            delete updated.finalPlanType;
                            if (next === 'basic') {
                              delete updated.paymentMode;
                              delete updated.transactionId;
                            }
                            return updated;
                          });
                        }}
                        disabled={savingId === reviewRequest.id}
                        className="mt-2 block w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white focus:border-white/40 focus:outline-none"
                      >
                        <option value="basic">Basic</option>
                        <option value="advanced">Advanced</option>
                        <option value="premium" disabled={!premiumPlanEnabled}>
                          {premiumPlanEnabled ? 'Premium' : 'Premium (Coming soon)'}
                        </option>
                      </select>
                      {approveFieldErrors.finalPlanType && (
                        <p className="mt-1 text-xs text-rose-300">{approveFieldErrors.finalPlanType}</p>
                      )}
                    </label>

                    {finalPlanType === 'basic' ? (
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <label className="block text-sm font-medium text-white/80">
                          Payment Mode
                          <input
                            type="text"
                            value="NA"
                            disabled
                            className="mt-2 block w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white/70"
                          />
                        </label>
                        <label className="block text-sm font-medium text-white/80">
                          Transaction ID
                          <input
                            type="text"
                            value="NA"
                            disabled
                            className="mt-2 block w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white/70"
                          />
                        </label>
                      </div>
                    ) : (
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <label className="block text-sm font-medium text-white/80">
                          Payment Mode *
                          <select
                            value={paymentMode}
                            onChange={(event) => {
                              setPaymentMode(event.target.value as 'cash' | 'online' | '');
                              setModalError(null);
                              setApproveFieldErrors((prev) => {
                                const updated = { ...prev };
                                delete updated.paymentMode;
                                return updated;
                              });
                            }}
                            disabled={savingId === reviewRequest.id}
                            className="mt-2 block w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white focus:border-white/40 focus:outline-none"
                          >
                            <option value="">Select payment mode</option>
                            <option value="cash">Cash</option>
                            <option value="online">Online</option>
                          </select>
                          {approveFieldErrors.paymentMode && (
                            <p className="mt-1 text-xs text-rose-300">{approveFieldErrors.paymentMode}</p>
                          )}
                        </label>

                        <label className="block text-sm font-medium text-white/80">
                          Transaction ID *
                          <input
                            type="text"
                            value={transactionId}
                            onChange={(event) => {
                              setTransactionId(event.target.value);
                              setModalError(null);
                              setApproveFieldErrors((prev) => {
                                const updated = { ...prev };
                                delete updated.transactionId;
                                return updated;
                              });
                            }}
                            disabled={savingId === reviewRequest.id}
                            className="mt-2 block w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white focus:border-white/40 focus:outline-none"
                            placeholder="Enter transaction id"
                          />
                          {approveFieldErrors.transactionId && (
                            <p className="mt-1 text-xs text-rose-300">{approveFieldErrors.transactionId}</p>
                          )}
                        </label>
                      </div>
                    )}
                  </div>

                  <label className="block text-sm font-medium text-white/80">
                    Rejection Comment * (required to reject)
                    <textarea
                      value={rejectComment}
                      onChange={(event) => setRejectComment(event.target.value)}
                      rows={3}
                      className="mt-2 block w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white focus:border-white/40 focus:outline-none"
                      placeholder="Explain why this request is being rejected"
                    />
                  </label>
                </div>
              </div>

              <div className="shrink-0 border-t border-white/10 px-5 pb-5 pt-4">
                {modalError && <p className="mb-3 text-xs text-rose-300">{modalError}</p>}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => performAction(reviewRequest, 'approve')}
                    disabled={savingId === reviewRequest.id || reviewRequest.status.toLowerCase() !== 'pending'}
                    className="inline-flex items-center rounded-full border border-emerald-400/60 bg-emerald-500/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.3em] text-emerald-200 hover:border-emerald-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 disabled:opacity-40"
                  >
                    {savingId === reviewRequest.id && savingAction === 'approve' ? 'Approving...' : 'Approve'}
                  </button>
                  <button
                    type="button"
                    onClick={() => performAction(reviewRequest, 'reject')}
                    disabled={savingId === reviewRequest.id || reviewRequest.status.toLowerCase() !== 'pending'}
                    className="inline-flex items-center rounded-full border border-rose-500/60 bg-rose-500/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.3em] text-rose-200 hover:border-rose-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/60 disabled:opacity-40"
                  >
                    {savingId === reviewRequest.id && savingAction === 'reject' ? 'Rejecting...' : 'Reject'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </Page>
  );
}
