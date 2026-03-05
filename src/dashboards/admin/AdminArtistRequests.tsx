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
const normalizePlan = (value: string) => {
  const s = (value || '').toLowerCase().trim();
  if (s === 'basic') return 'basic';
  if (s === 'advanced') return 'advanced';
  if (s === 'premium') return 'premium';
  return s;
};

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
  const [finalPlanType, setFinalPlanType] = useState<string>('basic');
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
    const requested = normalizePlan(String(request.requestedPlanType || ''));
    const defaultPlan = requested || 'basic';
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
        const normalizedFinalPlanType = normalizePlan(finalPlanType);
        const nextFieldErrors: ApproveFieldErrors = {};
        if (!normalizedFinalPlanType) {
          nextFieldErrors.finalPlanType = 'FINAL_PLAN_TYPE IS REQUIRED';
        }
        if (normalizedFinalPlanType === 'premium' && !premiumPlanEnabled) {
          nextFieldErrors.finalPlanType = 'Premium plan is not enabled.';
        }
        if (normalizedFinalPlanType === 'advanced' || normalizedFinalPlanType === 'premium') {
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
        const normalizedFinalPlanType = normalizePlan(finalPlanType);
        const approvalBody =
          action === 'approve'
            ? {
              final_plan_type: normalizedFinalPlanType,
              payment_mode: normalizedFinalPlanType === 'basic' ? 'NA' : paymentMode,
              transaction_id: normalizedFinalPlanType === 'basic' ? 'NA' : transactionId.trim(),
            }
            : undefined;
        if (action === 'approve') {
          console.log('[approve] payload', approvalBody);
        }

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
          <Page>
            <Container className="space-y-3">
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-[0.4em] text-slate-500 dark:text-slate-400">Admin</p>
                <h1 className="text-3xl font-semibold text-slate-900 dark:text-white">Artist Requests</h1>
              </div>
              <p className="text-slate-600 dark:text-slate-400">Authentication required.</p>
            </Container>
          </Page>
        </Container>
      </Page>
    );
  }

  if (loading) {
    return (
      <Page>
        <Container className="space-y-3">
          <Page>
            <Container className="space-y-3">
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-[0.4em] text-slate-500 dark:text-slate-400">Admin</p>
                <h1 className="text-3xl font-semibold text-slate-900 dark:text-white">Artist Requests</h1>
              </div>
              <LoadingSkeleton count={3} />
            </Container>
          </Page>
        </Container>
      </Page>
    );
  }

  return (
    <Page>
      <Container className="space-y-6">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.4em] text-slate-500 dark:text-slate-400">Admin</p>
          <h1 className="text-3xl font-semibold text-slate-900 dark:text-white">Artist Requests</h1>
          <p className="text-xs text-slate-600 dark:text-white/60">Manage incoming artist applications.</p>
        </div>

        <div className="flex items-center gap-3">
          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400" htmlFor="status-filter">
            Filter Status
          </label>
          <div className="relative">
            <select
              id="status-filter"
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value as (typeof STATUS_OPTIONS)[number]);
                setPage(1);
              }}
              className="appearance-none rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 pl-4 pr-10 py-2 text-sm font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 dark:focus:ring-emerald-500/20 focus:outline-none transition shadow-sm cursor-pointer"
            >
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                  {STATUS_LABELS[status]}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
              <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20">
                <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
              </svg>
            </div>
          </div>
          <span className="text-xs font-medium text-slate-500 dark:text-white/60">
            {total} total requests
          </span>
        </div>

        {error && <ErrorBanner message={error} onRetry={loadRequests} />}

        {requests.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-white/60">No pending artist requests</p>
        ) : (
          <div className="space-y-4">
            {requests.map((request) => (
              <div
                key={request.id}
                className="group relative overflow-hidden rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 p-6 shadow-sm hover:shadow-md dark:hover:bg-white/[0.07] transition-all duration-300"
              >
                <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <span className="rounded-md bg-indigo-50 dark:bg-indigo-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-500/20">
                        {request.source.replace(/_/g, ' ')}
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                        ID: {request.id}
                      </span>
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-emerald-400 transition-colors">
                        {request.artistName}
                      </h3>
                      {request.handle && (
                        <p className="font-mono text-sm text-indigo-600 dark:text-emerald-400">@{request.handle}</p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <p className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                        <svg className="h-4 w-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        {request.email || 'No email provided'}
                      </p>
                      {request.phone && (
                        <p className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                          <svg className="h-4 w-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5.25L3 18.75C3 19.3023 3.44772 19.75 4 19.75H20C20.5523 19.75 21 19.3023 21 18.75V5.25C21 4.69772 20.5523 4.25 20 4.25H4C3.44772 4.25 3 4.69772 3 5.25Z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5.25L12 11.25L21 5.25" />
                          </svg>
                          {request.phone}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 rounded-lg bg-slate-50 dark:bg-black/20 px-3 py-2 border border-slate-100 dark:border-white/5 w-fit">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Requested Plan</span>
                      <span className="text-xs font-bold text-slate-700 dark:text-white uppercase tracking-wider">
                        {request.requestedPlanType || 'BASIC'}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-4 min-w-[200px]">
                    <div className="flex flex-col items-end">
                      <span className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest ring-1 ring-inset ${request.status === 'approved' ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-emerald-500/20' :
                          request.status === 'rejected' ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 ring-rose-500/20' :
                            'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-amber-500/20'
                        }`}>
                        {formatStatus(request.status)}
                      </span>
                      <span className="mt-2 text-[10px] font-medium text-slate-400 dark:text-slate-500">
                        {new Date(request.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => openReview(request)}
                      className="group/btn relative inline-flex items-center justify-center rounded-xl bg-slate-900 dark:bg-white px-8 py-3 text-xs font-bold uppercase tracking-widest text-white dark:text-slate-950 transition-all hover:scale-[1.02] active:scale-95 shadow-lg shadow-slate-900/10 dark:shadow-white/5"
                    >
                      Review Application
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-white/5">
          <div className="text-xs font-bold uppercase tracking-widest text-slate-400">
            Page {page} of {Math.ceil(total / pageSize) || 1}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={page === 1}
              className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-600 dark:text-slate-300 disabled:opacity-40 transition hover:bg-slate-50 dark:hover:bg-white/10 shadow-sm"
            >
              Prev
            </button>
            <button
              type="button"
              onClick={() => setPage((prev) => prev + 1)}
              disabled={offset + pageSize >= total}
              className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-600 dark:text-slate-300 disabled:opacity-40 transition hover:bg-slate-50 dark:hover:bg-white/10 shadow-sm"
            >
              Next
            </button>
          </div>
        </div>
      </Container>

      {reviewRequest && (
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
                    onClick={closeReview}
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
                          <span className="text-sm font-bold text-slate-900 dark:text-white">{reviewRequest.artistName || '—'}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Handle</span>
                          <span className="text-sm font-mono text-indigo-600 dark:text-emerald-400">@{reviewRequest.handle || '—'}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Email</span>
                          <span className="text-sm font-medium text-slate-900 dark:text-white">{reviewRequest.email || '—'}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Phone</span>
                          <span className="text-sm font-medium text-slate-900 dark:text-white">{reviewRequest.phone || '—'}</span>
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
                          <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300 italic">"{reviewRequest.messageForFans || '—'}"</p>
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
                            onChange={(event) => {
                              const next = normalizePlan(event.target.value || '');
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

                      {finalPlanType === 'basic' ? (
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
                              className="block w-full rounded-2xl border border-slate-200 dark:border-white/15 bg-white dark:bg-black/40 px-5 py-3 text-sm font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 dark:focus:ring-emerald-500/20 outline-none transition shadow-inner"
                              placeholder="Enter receipt/transaction ref"
                            />
                            {approveFieldErrors.transactionId && (
                              <p className="mt-2 text-[10px] font-bold text-rose-600 dark:text-rose-300 uppercase tracking-widest">{approveFieldErrors.transactionId}</p>
                            )}
                          </label>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-white/10">
                    <label className="block">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2 block">Internal Feedback / Rejection Reason</span>
                      <textarea
                        value={rejectComment}
                        onChange={(event) => setRejectComment(event.target.value)}
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
                    onClick={() => performAction(reviewRequest, 'approve')}
                    disabled={savingId === reviewRequest.id || reviewRequest.status.toLowerCase() !== 'pending'}
                    className="flex-1 rounded-2xl bg-indigo-600 dark:bg-emerald-500 px-8 py-4 text-[10px] font-black uppercase tracking-[0.3em] text-white shadow-xl shadow-indigo-500/20 dark:shadow-emerald-500/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:scale-100"
                  >
                    {savingId === reviewRequest.id && savingAction === 'approve' ? 'Processing...' : 'Approve Application'}
                  </button>
                  <button
                    type="button"
                    onClick={() => performAction(reviewRequest, 'reject')}
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
      )}
    </Page>
  );
}
