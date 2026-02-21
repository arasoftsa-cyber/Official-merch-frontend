import React, { useCallback, useEffect, useState } from 'react';
import ErrorBanner from '../../components/ux/ErrorBanner';
import LoadingSkeleton from '../../components/ux/LoadingSkeleton';
import { useToast } from '../../components/ux/ToastHost';
import { apiFetch } from '../../shared/api/http';
import { getAccessToken } from '../../shared/auth/tokenStore';
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
  rejectionComment: string;
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
          profilePhotoUrl: String(
            (item as any).profile_photo_url ??
              (item as any).profile_photo_path ??
              item.profilePhotoUrl ??
              item.profilePhotoPath ??
              ''
          ).trim(),
          messageForFans: String(
            (item as any).message_for_fans ?? item.messageForFans ?? (item as any).fan_message ?? ''
          ).trim(),
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

  const openReview = (request: ArtistRequest) => {
    setReviewRequest(request);
    setRejectComment('');
    setModalError(null);
  };

  const closeReview = () => {
    setReviewRequest(null);
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

      setSavingId(request.id);
      setSavingAction(action);
      setModalError(null);

      try {
        await apiFetch(`${endpoint}/${request.id}/${action}`, {
          method: 'POST',
          ...(action === 'reject' ? { body: { comment: trimmedComment } } : {}),
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
        setModalError(err?.message ?? 'Action failed');
      } finally {
        setSavingId(null);
        setSavingAction(null);
      }
    },
    [loadRequests, notify, rejectComment]
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
          <div className="w-full max-w-3xl rounded-2xl border border-white/10 bg-slate-950 p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-white">Review Artist Request</h2>
              <button
                type="button"
                onClick={closeReview}
                className="rounded-full border border-white/20 px-3 py-1 text-xs uppercase tracking-[0.3em] text-white/80 hover:bg-white/10"
              >
                Close
              </button>
            </div>

            <div className="space-y-3 text-sm text-white/85">
              <p><span className="text-white/60">Artist Name:</span> {reviewRequest.artistName || '—'}</p>
              <p><span className="text-white/60">Handle:</span> {reviewRequest.handle || '—'}</p>
              <p><span className="text-white/60">Email:</span> {reviewRequest.email || '—'}</p>
              <p><span className="text-white/60">Phone:</span> {reviewRequest.phone || '—'}</p>
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

              {modalError && <p className="text-xs text-rose-300">{modalError}</p>}

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
      )}
    </Page>
  );
}
