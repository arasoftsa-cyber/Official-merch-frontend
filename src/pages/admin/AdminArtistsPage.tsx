import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AppShell from '../../components/layout/AppShell';
import ErrorBanner from '../../components/ux/ErrorBanner';
import LoadingSkeleton from '../../components/ux/LoadingSkeleton';
import DataTable, { TableColumn } from '../../components/ui/DataTable';
import { apiFetch } from '../../shared/api/http';

type AdminArtistRow = {
  id: string;
  name: string;
  handle: string;
  email: string;
  status: string;
};

const normalizeRows = (payload: any): AdminArtistRow[] => {
  const items = Array.isArray(payload?.items)
    ? payload.items
    : Array.isArray(payload)
    ? payload
    : [];
  return items.map((item: any) => ({
    id: String(item?.id ?? ''),
    name: String(item?.name ?? item?.artist_name ?? item?.artistName ?? 'Unknown'),
    handle: String(item?.handle ?? ''),
    email: String(item?.email ?? item?.contact_email ?? ''),
    status: String(item?.status ?? 'active'),
  }));
};

export default function AdminArtistsPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<AdminArtistRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [endpointUnavailable, setEndpointUnavailable] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    setEndpointUnavailable(false);
    try {
      const payload = await apiFetch('/admin/artists');
      setRows(normalizeRows(payload));
    } catch (err: any) {
      const message = String(err?.message ?? '');
      if (message.includes('HTTP_404')) {
        setEndpointUnavailable(true);
        setRows([]);
      } else {
        setError(message || 'Failed to load artists.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const columns: TableColumn<AdminArtistRow>[] = useMemo(
    () => [
      { header: 'Name', key: 'name' },
      { header: 'Handle', render: (row) => (row.handle ? `@${row.handle}` : '-') },
      { header: 'Email', key: 'email' },
      { header: 'Status', key: 'status' },
    ],
    []
  );

  return (
    <AppShell title="Admin Artists" subtitle="Onboarded artists list">
      <div className="flex items-center justify-between">
        <Link className="text-sm text-slate-300 underline" to="/partner/admin">
          Back to admin dashboard
        </Link>
      </div>

      {loading && <LoadingSkeleton count={2} />}
      {error && <ErrorBanner message={error} onRetry={load} />}

      {!loading && endpointUnavailable && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-slate-300">
          <p>Artists endpoint is not available yet.</p>
          <p className="mt-2 text-slate-400">Expected endpoint: <code>/api/admin/artists</code></p>
        </div>
      )}

      {!loading && !endpointUnavailable && !error && (
        <DataTable
          columns={columns}
          rows={rows}
          emptyText="No onboarded artists found."
          rowOnClick={(row) => navigate(`/partner/admin/artists/${row.id}`)}
        />
      )}
    </AppShell>
  );
}
