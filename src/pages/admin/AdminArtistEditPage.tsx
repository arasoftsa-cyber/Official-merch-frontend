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
        <Link className="text-sm text-slate-300 underline" to={id ? `/partner/admin/artists/${id}` : '/partner/admin/artists'}>
          Back to artist detail
        </Link>
        <Link className="text-sm text-slate-300 underline" to="/partner/admin/artists">
          Back to artists
        </Link>
      </div>

      {loading && <LoadingSkeleton count={2} />}
      {error && <ErrorBanner message={error} onRetry={load} />}

      {!loading && !error && detail && (
        <div className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-5">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
            Edit flow entry point is enabled. Field updates can be wired next.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm text-white">
              Name
              <input
                value={detail.name}
                readOnly
                className="mt-2 w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-slate-300"
              />
            </label>
            <label className="text-sm text-white">
              Handle
              <input
                value={detail.handle ? `@${detail.handle}` : '-'}
                readOnly
                className="mt-2 w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-slate-300"
              />
            </label>
            <label className="text-sm text-white">
              Email
              <input
                value={detail.email || '-'}
                readOnly
                className="mt-2 w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-slate-300"
              />
            </label>
            <label className="text-sm text-white">
              Status
              <input
                value={detail.status || '-'}
                readOnly
                className="mt-2 w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-slate-300"
              />
            </label>
            <label className="text-sm text-white md:col-span-2">
              Phone
              <input
                value={detail.phone || '-'}
                readOnly
                className="mt-2 w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-slate-300"
              />
            </label>
          </div>
        </div>
      )}
    </AppShell>
  );
}

