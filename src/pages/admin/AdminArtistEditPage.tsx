import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import AppShell from '../../components/layout/AppShell';
import ErrorBanner from '../../components/ux/ErrorBanner';
import LoadingSkeleton from '../../components/ux/LoadingSkeleton';
import { apiFetch } from '../../shared/api/http';

type AdminArtistEdit = {
  id: string;
  name: string;
  handle: string;
  email: string;
  status: string;
  phone: string;
};

const normalize = (payload: any): AdminArtistEdit => {
  const row = payload?.item ?? payload?.artist ?? payload ?? {};
  return {
    id: String(row?.id ?? ''),
    name: String(row?.name ?? row?.artist_name ?? row?.artistName ?? ''),
    handle: String(row?.handle ?? '').replace(/^@/, ''),
    email: String(row?.email ?? row?.contact_email ?? ''),
    status: String(row?.status ?? ''),
    phone: String(row?.phone ?? row?.contact_phone ?? ''),
  };
};

export default function AdminArtistEditPage() {
  const { id } = useParams<{ id: string }>();
  const [detail, setDetail] = useState<AdminArtistEdit | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!id) {
      setError('Missing artist id.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const payload = await apiFetch(`/admin/artists/${id}`);
      setDetail(normalize(payload));
    } catch (err: any) {
      setError(String(err?.message || 'Failed to load artist.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [id]);

  return (
    <AppShell title="Edit Artist" subtitle="Admin artist editor">
      <div className="flex items-center justify-between">
        <Link className="text-sm text-indigo-600 dark:text-slate-300 underline hover:text-indigo-800 dark:hover:text-white transition-colors" to={id ? `/partner/admin/artists/${id}` : '/partner/admin/artists'}>
          Back to artist detail
        </Link>
        <Link className="text-sm text-indigo-600 dark:text-slate-300 underline hover:text-indigo-800 dark:hover:text-white transition-colors" to="/partner/admin/artists">
          Back to artists
        </Link>
      </div>

      {loading && <LoadingSkeleton count={2} />}
      {error && <ErrorBanner message={error} onRetry={load} />}

      {!loading && !error && detail && (
        <div className="space-y-6 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 p-6 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400 flex items-center gap-2">
            <span className="w-1 h-3 bg-indigo-500 dark:bg-emerald-500 rounded-full"></span>
            Edit flow entry point is enabled. Field updates can be wired next.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Name
              <input
                value={detail.name}
                readOnly
                className="mt-1.5 w-full rounded-xl border border-slate-200 dark:border-white/15 bg-slate-50 dark:bg-black/30 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-400 cursor-not-allowed"
              />
            </label>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Handle
              <input
                value={detail.handle ? `@${detail.handle}` : '-'}
                readOnly
                className="mt-1.5 w-full rounded-xl border border-slate-200 dark:border-white/15 bg-slate-50 dark:bg-black/30 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-400 cursor-not-allowed"
              />
            </label>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Email
              <input
                value={detail.email || '-'}
                readOnly
                className="mt-1.5 w-full rounded-xl border border-slate-200 dark:border-white/15 bg-slate-50 dark:bg-black/30 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-400 cursor-not-allowed"
              />
            </label>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Status
              <input
                value={detail.status || '-'}
                readOnly
                className="mt-1.5 w-full rounded-xl border border-slate-200 dark:border-white/15 bg-slate-50 dark:bg-black/30 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-400 cursor-not-allowed"
              />
            </label>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 md:col-span-2">
              Phone
              <input
                value={detail.phone || '-'}
                readOnly
                className="mt-1.5 w-full rounded-xl border border-slate-200 dark:border-white/15 bg-slate-50 dark:bg-black/30 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-400 cursor-not-allowed"
              />
            </label>
          </div>
        </div>
      )}
    </AppShell>
  );
}

