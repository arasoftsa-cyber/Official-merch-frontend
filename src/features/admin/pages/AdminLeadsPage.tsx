import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { API_BASE } from '../../../shared/api/http';
import { getAccessToken } from '../../../shared/auth/tokenStore';
import { Container, Page } from '../../../shared/ui/Page';

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
  if (!value) return 'Ã¢â‚¬â€';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
};

const statusChipClass = (status: LeadStatus) => {
  if (status === 'converted') return 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-200 ring-emerald-400/30';
  if (status === 'contacted') return 'bg-sky-50 dark:bg-sky-500/20 text-sky-600 dark:text-sky-200 ring-sky-400/30';
  if (status === 'ignored') return 'bg-rose-50 dark:bg-rose-500/20 text-rose-600 dark:text-rose-200 ring-rose-400/30';
  return 'bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-100 ring-slate-200 dark:ring-white/20';
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
          <p className="text-xs font-bold uppercase tracking-[0.4em] text-slate-500 dark:text-slate-400">Admin</p>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Drop Quiz Leads</h1>
          <p className="text-xs text-slate-500 dark:text-white/60">
            Canonical inbox: <code className="bg-slate-100 dark:bg-white/5 px-1 rounded text-indigo-600 dark:text-emerald-400">/api/admin/leads</code>. Sorted by score desc, newest first.
          </p>
        </div>

        {loading && <p className="text-sm text-slate-500 dark:text-white/70 animate-pulse">Loading leadsÃ¢â‚¬Â¦</p>}
        {error && <p role="alert" className="text-sm font-medium text-rose-600 dark:text-rose-300 bg-rose-50 dark:bg-rose-500/10 px-4 py-2 rounded-lg border border-rose-200 dark:border-rose-500/20">{error}</p>}

        {!loading && !error && (
          <>
            <div className="overflow-auto rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 shadow-sm transition-all duration-300">
              <table className="min-w-full text-left text-sm text-slate-700 dark:text-slate-200">
                <thead className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-black/20">
                  <tr>
                    <th className="px-4 py-3">Source</th>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Contact</th>
                    <th className="px-4 py-3">Drop</th>
                    <th className="px-4 py-3">Score</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedRows.map((row) => (
                    <tr
                      key={row.id}
                      onClick={() => setSelectedId(row.id)}
                      className="cursor-pointer border-t border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/10 transition-colors"
                    >
                      <td className="px-4 py-3 font-medium">{row.source ?? 'Ã¢â‚¬â€'}</td>
                      <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">{row.name ?? 'Ã¢â‚¬â€'}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{row.email ?? row.phone ?? 'Ã¢â‚¬â€'}</td>
                      <td className="px-4 py-3 font-mono text-xs">{row.drop_handle ?? 'Ã¢â‚¬â€'}</td>
                      <td className="px-4 py-3">
                        <span className="font-bold text-slate-900 dark:text-white">{row.score}</span>
                        <span className="text-slate-400">/{row.maxScore}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest ring-1 ring-inset ${statusChipClass(
                            row.status
                          )}`}
                        >
                          {row.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap">{formatDate(row.created_at)}</td>
                    </tr>
                  ))}
                  {sortedRows.length === 0 && (
                    <tr>
                      <td className="px-4 py-8 text-center text-slate-500 dark:text-slate-400 italic" colSpan={7}>
                        No leads found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {selectedRow && (
              <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setSelectedId(null)}>
                <section
                  className="absolute right-0 top-0 h-full w-full max-w-lg space-y-6 overflow-auto border-l border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950 p-6 shadow-2xl animate-in slide-in-from-right duration-300"
                  onClick={(event) => event.stopPropagation()}
                >
                  <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-4">
                    <h2 className="text-xs font-bold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-300 flex items-center gap-2">
                      <span className="w-1 h-3 bg-indigo-500 dark:bg-emerald-500 rounded-full"></span>
                      Lead Detail
                    </h2>
                    <button
                      type="button"
                      onClick={() => setSelectedId(null)}
                      className="rounded-xl border border-slate-300 dark:border-white/20 bg-white dark:bg-white/5 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition shadow-sm"
                    >
                      Close
                    </button>
                  </div>
                  <div className="space-y-3 text-sm text-slate-600 dark:text-slate-200">
                    <p className="flex justify-between border-b border-slate-100 dark:border-white/5 pb-2">
                      <span className="font-bold text-slate-400 dark:text-slate-500 uppercase text-[10px] tracking-wider">Name</span>
                      <span className="font-medium text-slate-900 dark:text-white">{selectedRow.name ?? 'Ã¢â‚¬â€'}</span>
                    </p>
                    <p className="flex justify-between border-b border-slate-100 dark:border-white/5 pb-2">
                      <span className="font-bold text-slate-400 dark:text-slate-500 uppercase text-[10px] tracking-wider">Email</span>
                      <span className="font-medium text-slate-900 dark:text-white">{selectedRow.email ?? 'Ã¢â‚¬â€'}</span>
                    </p>
                    <p className="flex justify-between border-b border-slate-100 dark:border-white/5 pb-2">
                      <span className="font-bold text-slate-400 dark:text-slate-500 uppercase text-[10px] tracking-wider">Phone</span>
                      <span className="font-medium text-slate-900 dark:text-white">{selectedRow.phone ?? 'Ã¢â‚¬â€'}</span>
                    </p>
                    <p className="flex justify-between border-b border-slate-100 dark:border-white/5 pb-2">
                      <span className="font-bold text-slate-400 dark:text-slate-500 uppercase text-[10px] tracking-wider">Drop</span>
                      <span className="font-mono text-xs font-medium text-indigo-600 dark:text-emerald-400">{selectedRow.drop_handle ?? 'Ã¢â‚¬â€'}</span>
                    </p>
                    <p className="flex justify-between border-b border-slate-100 dark:border-white/5 pb-2">
                      <span className="font-bold text-slate-400 dark:text-slate-500 uppercase text-[10px] tracking-wider">Score</span>
                      <span className="font-bold text-slate-900 dark:text-white">{selectedRow.score}/{selectedRow.maxScore}</span>
                    </p>
                    <p className="flex justify-between border-b border-slate-100 dark:border-white/5 pb-2">
                      <span className="font-bold text-slate-400 dark:text-slate-500 uppercase text-[10px] tracking-wider">Updated</span>
                      <span className="text-[12px]">{formatDate(selectedRow.updated_at)}</span>
                    </p>
                  </div>
                  <div className="space-y-4 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 p-5 shadow-inner">
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                      Status
                    </label>
                    <select
                      value={editorStatus}
                      onChange={(event) => setEditorStatus(event.target.value as LeadStatus)}
                      className="w-full rounded-xl border border-slate-200 dark:border-white/15 bg-white dark:bg-slate-900 px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 dark:focus:ring-emerald-500 outline-none transition appearance-none cursor-pointer"
                    >
                      {STATUS_OPTIONS.map((status) => (
                        <option key={status} value={status} className="dark:bg-slate-900">
                          {status}
                        </option>
                      ))}
                    </select>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                      Internal note
                    </label>
                    <textarea
                      value={editorNote}
                      onChange={(event) => setEditorNote(event.target.value)}
                      rows={4}
                      className="w-full rounded-xl border border-slate-200 dark:border-white/15 bg-white dark:bg-slate-900 px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 dark:focus:ring-emerald-500 outline-none transition shadow-inner"
                      placeholder="Add internal note..."
                    />
                    {saveError && <p className="text-xs font-medium text-rose-600 dark:text-rose-300">{saveError}</p>}
                    <button
                      type="button"
                      onClick={saveLead}
                      disabled={saveLoading}
                      className="w-full rounded-xl bg-indigo-600 dark:bg-slate-700 px-6 py-2.5 text-xs font-bold uppercase tracking-widest text-white shadow-lg shadow-indigo-500/20 dark:shadow-black/20 hover:bg-indigo-700 dark:hover:bg-slate-600 transition disabled:opacity-50"
                    >
                      {saveLoading ? 'Saving...' : 'Save Lead Changes'}
                    </button>
                  </div>
                  <div className="space-y-3 rounded-2xl border border-emerald-100 dark:border-emerald-500/20 bg-emerald-50/50 dark:bg-emerald-500/5 p-5">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                      Lead Bridge
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                      Optional admin action: convert this lead into an artist access request.
                    </p>
                    {convertError && <p className="text-xs font-medium text-rose-600 dark:text-rose-300">{convertError}</p>}
                    {convertSuccess && (
                      <p className="rounded-lg bg-emerald-100 dark:bg-emerald-500/20 px-3 py-2 text-xs font-bold text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30">
                        {convertSuccess}
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={convertLeadToArtistRequest}
                      disabled={convertLoading}
                      className="w-full rounded-xl border border-emerald-300 dark:border-emerald-400/40 bg-white dark:bg-transparent px-6 py-2.5 text-xs font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition shadow-sm disabled:opacity-50"
                    >
                      {convertLoading ? 'Converting...' : 'Convert lead -> artist request'}
                    </button>
                  </div>
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">RAW ANSWERS</p>
                    <pre className="max-h-64 overflow-auto rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-black/30 p-4 font-mono text-[10px] text-slate-600 dark:text-slate-300 shadow-inner">
                      {JSON.stringify(selectedRow.answers_json ?? {}, null, 2)}
                    </pre>
                  </div>
                </section>
              </div>
            )}
          </>
        )}
      </Container>
    </Page>
  );
}
