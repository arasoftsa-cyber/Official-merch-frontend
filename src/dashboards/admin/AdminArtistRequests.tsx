import React, { useCallback, useEffect, useState } from 'react';
import ErrorBanner from '../../components/ux/ErrorBanner';
import LoadingSkeleton from '../../components/ux/LoadingSkeleton';
import { useToast } from '../../components/ux/ToastHost';
import { apiFetch } from '../../shared/api/http';
import { getAccessToken } from '../../shared/auth/tokenStore';
import { Container, Page } from '../../ui/Page';

const endpoint = '/api/admin/artist-access-requests';
const STATUS_OPTIONS = ['pending', 'approved', 'rejected'] as const;
const STATUS_LABELS: Record<typeof STATUS_OPTIONS[number], string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
};
const LIMIT = 20;

type ArtistRequest = {
  id: string;
  createdAt: string;
  status: string;
  source: string;
  labelId?: string | null;
  name: string;
  handleSuggestion?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  socials?: string | null;
  pitch?: string | null;
};

const formatStatus = (status?: string) => (status ? status.toUpperCase() : 'PENDING');

export default function AdminArtistRequests() {
  const token = getAccessToken();
  const { notify } = useToast();
  const [requests, setRequests] = useState<ArtistRequest[]>([]);
  const [total, setTotal] = useState(0);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savingAction, setSavingAction] = useState<'approve' | 'reject' | null>(null);
  const [actionError, setActionError] = useState<{ id: string; message: string } | null>(null);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<typeof STATUS_OPTIONS[number]>('pending');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pageSize = LIMIT;
  const offset = (page - 1) * pageSize;

  const buildUrl = useCallback(() => {
    const params = new URLSearchParams();
    params.set('pageSize', LIMIT.toString());
    params.set('page', page.toString());
    if (statusFilter) {
      params.set('status', statusFilter);
    }
    return `${endpoint}?${params.toString()}`;
  }, [page, statusFilter]);

  const loadRequests = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const payload = await apiFetch(buildUrl());
      let items: ArtistRequest[] = [];
      let totalCount = 0;
      let pageFromPayload = page;
      let pageSizeFromPayload = LIMIT;
      if (Array.isArray(payload)) {
        items = payload;
        totalCount = payload.length;
      } else {
        items = payload?.items ?? [];
        totalCount = payload?.total ?? items.length;
        pageFromPayload = Number(payload?.page) || page;
        pageSizeFromPayload = Number(payload?.pageSize) || LIMIT;
      }
      const normalized = items.map((item) => {
        const artistName =
          (item as any).artist_name ?? item.name ?? (item as any).artistName ?? 'Unknown';
        const contactEmail =
          (item as any).contact_email ?? item.contactEmail ?? null;
        const contactPhone =
          (item as any).contact_phone ?? item.contactPhone ?? null;
        const createdAt =
          (item as any).created_at ?? item.createdAt ?? new Date().toISOString();
        const socialsValue = item.socials ?? (item as any).socials ?? null;
        let socialsFormatted = '—';
        if (socialsValue && typeof socialsValue === 'object') {
          socialsFormatted = Object.keys(socialsValue).join(', ') || '—';
        }
        return {
          ...item,
          name: artistName,
          contactEmail,
          contactPhone,
          createdAt,
          socials: socialsFormatted,
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

  const performAction = useCallback(
    async (id: string, action: 'approve' | 'reject') => {
      setSavingId(id);
      setActionError(null);
      try {
        await apiFetch(`${endpoint}/${id}/${action}`, { method: 'POST' });
        notify(`Request ${action === 'approve' ? 'approved' : 'rejected'}`, 'success');
        await loadRequests();
      } catch (err: any) {
        const message =
          err?.error === 'invalid_transition'
            ? err?.message ?? 'Invalid transition'
            : err?.message ?? 'Action failed';
        setActionError({ id, message });
      } finally {
        setSavingId(null);
      }
    },
    [loadRequests, notify]
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
              setStatusFilter(event.target.value as typeof STATUS_OPTIONS[number]);
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
                    <p className="text-lg font-semibold text-white">{request.name}</p>
                    {request.handleSuggestion && (
                      <p className="text-xs text-white/60">@{request.handleSuggestion}</p>
                    )}
                    <p className="text-xs text-white/60">
                      {request.contactEmail ?? request.contactPhone ?? 'No contact info'}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 text-[11px] uppercase tracking-[0.3em] text-white/60">
                    <span>{formatStatus(request.status)}</span>
                    <span>Submitted {new Date(request.createdAt).toLocaleString()}</span>
                  </div>
                </div>
                {statusFilter === 'pending' && request.status.toLowerCase() === 'pending' && (
                  <div className="mt-3 flex flex-col gap-2">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => performAction(request.id, 'approve')}
                        disabled={savingId === request.id}
                        className="inline-flex items-center rounded-full border border-emerald-400/60 bg-emerald-500/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.3em] text-emerald-200 hover:border-emerald-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 disabled:opacity-40"
                      >
                        {savingId === request.id && savingAction === 'approve'
                          ? 'Approving...'
                          : 'Approve'}
                      </button>
                      <button
                        type="button"
                        onClick={() => performAction(request.id, 'reject')}
                        disabled={savingId === request.id}
                        className="inline-flex items-center rounded-full border border-rose-500/60 bg-rose-500/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.3em] text-rose-200 hover:border-rose-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/60 disabled:opacity-40"
                      >
                        {savingId === request.id && savingAction === 'reject'
                          ? 'Rejecting...'
                          : 'Reject'}
                      </button>
                    </div>
                    {actionError?.id === request.id && (
                      <p className="text-xs text-rose-300">{actionError.message}</p>
                    )}
                  </div>
                )}
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
    </Page>
  );
}
