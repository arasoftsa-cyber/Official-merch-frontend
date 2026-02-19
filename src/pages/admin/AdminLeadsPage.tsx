import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { API_BASE } from '../../shared/api/http';
import { getAccessToken } from '../../shared/auth/tokenStore';
import { Container, Page } from '../../ui/Page';

const STATUS_OPTIONS = ['new', 'contacted', 'converted', 'ignored'] as const;
type LeadStatus = (typeof STATUS_OPTIONS)[number];

type LeadRow = {
  id: string;
  source: string;
  drop_handle: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  status: LeadStatus;
  admin_note: string | null;
  created_at: string | null;
  updated_at: string | null;
  score: number;
  maxScore: number;
  answers_json?: Record<string, unknown> | null;
};

const formatDate = (value?: string | null) => {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
};

const statusChipClass = (status: LeadStatus) => {
  if (status === 'converted') return 'bg-emerald-500/20 text-emerald-200 ring-emerald-400/30';
  if (status === 'contacted') return 'bg-sky-500/20 text-sky-200 ring-sky-400/30';
  if (status === 'ignored') return 'bg-rose-500/20 text-rose-200 ring-rose-400/30';
  return 'bg-white/10 text-slate-100 ring-white/20';
};

export default function AdminLeadsPage() {
  const [rows, setRows] = useState<LeadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editorStatus, setEditorStatus] = useState<LeadStatus>('new');
  const [editorNote, setEditorNote] = useState('');
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [convertLoading, setConvertLoading] = useState(false);
  const [convertError, setConvertError] = useState<string | null>(null);
  const [convertSuccess, setConvertSuccess] = useState<string | null>(null);
  const loggedPayloadLengthRef = useRef(false);

  const loadLeads = useCallback(async () => {
    const token = getAccessToken();
    const response = await fetch(
      `${API_BASE}/api/admin/leads`,
      {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'Cache-Control': 'no-cache',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        cache: 'no-store',
        credentials: 'include',
      }
    );

    if (response.status === 304) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`HTTP_${response.status}`);
    }

    const payload = await response.json();
    return Array.isArray(payload?.items)
      ? payload.items
      : Array.isArray(payload)
      ? payload
      : [];
  }, []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const items = await loadLeads();
        if (!active || !items) return;
        if (!loggedPayloadLengthRef.current && import.meta.env.DEV) {
          // eslint-disable-next-line no-console
          console.log('[admin leads] payload length:', items.length);
          loggedPayloadLengthRef.current = true;
        }
        setRows(
          items.map((item: any) => ({
            id: item.id,
            source: item.source ?? 'drop_quiz',
            drop_handle: item.drop_handle ?? null,
            name: item.name ?? null,
            email: item.email ?? null,
            phone: item.phone ?? null,
            status: (item.status ?? 'new') as LeadStatus,
            admin_note: item.admin_note ?? null,
            created_at: item.created_at ?? null,
            updated_at: item.updated_at ?? null,
            score: Number(item.score ?? 0),
            maxScore: Number(item.maxScore ?? 0),
            answers_json: item.answers_json ?? null,
          }))
        );
      } catch (err: any) {
        if (active) {
          setError(err?.message ?? 'Unable to load leads');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [loadLeads]);

  const sortedRows = useMemo(
    () =>
      [...rows].sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        const at = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bt = b.created_at ? new Date(b.created_at).getTime() : 0;
        return bt - at;
      }),
    [rows]
  );

  const selectedRow = sortedRows.find((row) => row.id === selectedId) ?? null;

  useEffect(() => {
    if (!selectedRow) return;
    setEditorStatus(selectedRow.status ?? 'new');
    setEditorNote(selectedRow.admin_note ?? '');
    setSaveError(null);
    setConvertError(null);
    setConvertSuccess(null);
  }, [selectedRow]);

  const saveLead = async () => {
    if (!selectedRow) return;
    setSaveLoading(true);
    setSaveError(null);
    try {
      const token = getAccessToken();
      const response = await fetch(
        `${API_BASE}/api/admin/leads/${selectedRow.id}`,
        {
          method: 'PATCH',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          credentials: 'include',
          body: JSON.stringify({
            status: editorStatus,
            adminNote: editorNote,
          }),
        }
      );
      if (!response.ok) {
        throw new Error(`HTTP_${response.status}`);
      }

      const refreshed = await loadLeads();
      if (refreshed) {
        setRows(
          refreshed.map((item: any) => ({
            id: item.id,
            source: item.source ?? 'drop_quiz',
            drop_handle: item.drop_handle ?? null,
            name: item.name ?? null,
            email: item.email ?? null,
            phone: item.phone ?? null,
            status: (item.status ?? 'new') as LeadStatus,
            admin_note: item.admin_note ?? null,
            created_at: item.created_at ?? null,
            updated_at: item.updated_at ?? null,
            score: Number(item.score ?? 0),
            maxScore: Number(item.maxScore ?? 0),
            answers_json: item.answers_json ?? null,
          }))
        );
      }
    } catch (err: any) {
      setSaveError(err?.message ?? 'Save failed');
    } finally {
      setSaveLoading(false);
    }
  };

  const convertLeadToArtistRequest = async () => {
    if (!selectedRow) return;
    setConvertLoading(true);
    setConvertError(null);
    setConvertSuccess(null);
    try {
      const token = getAccessToken();
      const artistName = selectedRow.name?.trim() || 'Lead Applicant';
      const email = selectedRow.email?.trim() || '';
      if (!email) {
        throw new Error('Lead is missing email; cannot create artist request.');
      }

      const response = await fetch(`${API_BASE}/api/artist-access-requests`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({
          artist_name: artistName,
          email,
          phone: selectedRow.phone ?? null,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        const message = payload?.message || payload?.error || `HTTP_${response.status}`;
        throw new Error(message);
      }

      const payload = await response.json().catch(() => ({}));
      const requestId = payload?.requestId || payload?.id || 'created';
      setConvertSuccess(`Artist request created (${requestId}).`);
    } catch (err: any) {
      setConvertError(err?.message ?? 'Unable to convert lead.');
    } finally {
      setConvertLoading(false);
    }
  };

  return (
    <Page>
      <Container className="space-y-4">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Admin</p>
          <h1 className="text-3xl font-semibold text-white">Drop Quiz Leads</h1>
          <p className="text-xs text-white/60">Canonical inbox: <code>/api/admin/leads</code>. Sorted by score desc, newest first.</p>
        </div>

        {loading && <p className="text-sm text-white/70">Loading leads…</p>}
        {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}

        {!loading && !error && (
          <>
            <div className="overflow-auto rounded-2xl border border-white/10 bg-white/5">
              <table className="min-w-full text-left text-sm text-slate-200">
                <thead className="text-xs uppercase tracking-[0.2em] text-slate-400">
                  <tr>
                    <th className="px-3 py-2">Source</th>
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">Contact</th>
                    <th className="px-3 py-2">Drop</th>
                    <th className="px-3 py-2">Score</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedRows.map((row) => (
                    <tr
                      key={row.id}
                      onClick={() => setSelectedId(row.id)}
                      className="cursor-pointer border-t border-white/10 hover:bg-white/10"
                    >
                      <td className="px-3 py-2">{row.source ?? '—'}</td>
                      <td className="px-3 py-2">{row.name ?? '—'}</td>
                      <td className="px-3 py-2">{row.email ?? row.phone ?? '—'}</td>
                      <td className="px-3 py-2">{row.drop_handle ?? '—'}</td>
                      <td className="px-3 py-2">
                        {row.score}/{row.maxScore}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`inline-flex rounded-full px-2 py-1 text-[10px] uppercase tracking-[0.2em] ring-1 ${statusChipClass(
                            row.status
                          )}`}
                        >
                          {row.status}
                        </span>
                      </td>
                      <td className="px-3 py-2">{formatDate(row.created_at)}</td>
                    </tr>
                  ))}
                  {sortedRows.length === 0 && (
                    <tr>
                      <td className="px-3 py-6 text-center text-slate-400" colSpan={7}>
                        No leads found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {selectedRow && (
              <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setSelectedId(null)}>
                <section
                  className="absolute right-0 top-0 h-full w-full max-w-lg space-y-3 overflow-auto border-l border-white/10 bg-slate-950 p-4"
                  onClick={(event) => event.stopPropagation()}
                >
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-300">
                      Lead Detail
                    </h2>
                    <button
                      type="button"
                      onClick={() => setSelectedId(null)}
                      className="rounded-full border border-white/20 px-3 py-1 text-xs text-white/80"
                    >
                      Close
                    </button>
                  </div>
                  <div className="space-y-1 text-sm text-slate-200">
                    <p><strong>Name:</strong> {selectedRow.name ?? '—'}</p>
                    <p><strong>Email:</strong> {selectedRow.email ?? '—'}</p>
                    <p><strong>Phone:</strong> {selectedRow.phone ?? '—'}</p>
                    <p><strong>Drop:</strong> {selectedRow.drop_handle ?? '—'}</p>
                    <p><strong>Score:</strong> {selectedRow.score}/{selectedRow.maxScore}</p>
                    <p><strong>Updated:</strong> {formatDate(selectedRow.updated_at)}</p>
                  </div>
                  <div className="space-y-2 rounded-xl border border-white/10 bg-white/5 p-3">
                    <label className="block text-xs uppercase tracking-[0.2em] text-slate-300">
                      Status
                    </label>
                    <select
                      value={editorStatus}
                      onChange={(event) => setEditorStatus(event.target.value as LeadStatus)}
                      className="w-full rounded-md border border-white/20 bg-slate-900 px-3 py-2 text-sm text-white"
                    >
                      {STATUS_OPTIONS.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                    <label className="block text-xs uppercase tracking-[0.2em] text-slate-300">
                      Internal note
                    </label>
                    <textarea
                      value={editorNote}
                      onChange={(event) => setEditorNote(event.target.value)}
                      rows={4}
                      className="w-full rounded-md border border-white/20 bg-slate-900 px-3 py-2 text-sm text-white"
                      placeholder="Add internal note..."
                    />
                    {saveError && <p className="text-xs text-rose-300">{saveError}</p>}
                    <button
                      type="button"
                      onClick={saveLead}
                      disabled={saveLoading}
                      className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-white disabled:opacity-50"
                    >
                      {saveLoading ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                  <div className="space-y-2 rounded-xl border border-white/10 bg-white/5 p-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-300">Bridge</p>
                    <p className="text-xs text-slate-400">
                      Optional admin action: convert this lead into an artist access request.
                    </p>
                    {convertError && <p className="text-xs text-rose-300">{convertError}</p>}
                    {convertSuccess && <p className="text-xs text-emerald-300">{convertSuccess}</p>}
                    <button
                      type="button"
                      onClick={convertLeadToArtistRequest}
                      disabled={convertLoading}
                      className="rounded-full border border-emerald-400/40 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-emerald-200 disabled:opacity-50"
                    >
                      {convertLoading ? 'Converting...' : 'Convert lead -> artist request'}
                    </button>
                  </div>
                  <pre className="max-h-64 overflow-auto rounded-xl bg-black/30 p-3 text-xs text-slate-200">
                    {JSON.stringify(selectedRow.answers_json ?? {}, null, 2)}
                  </pre>
                </section>
              </div>
            )}
          </>
        )}
      </Container>
    </Page>
  );
}
