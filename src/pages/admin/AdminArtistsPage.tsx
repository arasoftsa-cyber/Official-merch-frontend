import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AppShell from '../../components/layout/AppShell';
import ErrorBanner from '../../components/ux/ErrorBanner';
import LoadingSkeleton from '../../components/ux/LoadingSkeleton';
import { useToast } from '../../components/ux/ToastHost';
import DataTable, { TableColumn } from '../../components/ui/DataTable';
import { apiFetch } from '../../shared/api/http';
import AdminArtistEditModal from './AdminArtistEditModal';

type AdminArtistRow = {
  id: string;
  name: string;
  handle: string;
  email: string;
  status: string;
  is_featured: boolean;
};

const toText = (value: unknown) => String(value ?? '').trim();
const withDash = (value: unknown) => {
  const text = toText(value);
  return text ? text : '-';
};
const normalizeHandle = (value: unknown) => {
  const text = toText(value);
  if (!text) return '-';
  return text.startsWith('@') ? text : `@${text}`;
};
const normalizeStatusLabel = (value: unknown) => {
  const raw = toText(value).toLowerCase();
  if (!raw) return '-';
  const mapped = raw === 'denied' ? 'rejected' : raw;
  return mapped
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

const normalizeRows = (payload: any): AdminArtistRow[] => {
  const items = Array.isArray(payload?.items)
    ? payload.items
    : Array.isArray(payload)
    ? payload
    : [];
  return items.map((item: any) => ({
    id: String(item?.id ?? ''),
    name: toText(item?.name ?? item?.artist_name ?? item?.artistName),
    handle: toText(item?.handle),
    email: toText(item?.email ?? item?.contact_email),
    status: toText(item?.status),
    is_featured: Boolean(item?.is_featured ?? item?.isFeatured),
  }));
};

export default function AdminArtistsPage() {
  const navigate = useNavigate();
  const { notify } = useToast();
  const [rows, setRows] = useState<AdminArtistRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [savingFeaturedById, setSavingFeaturedById] = useState<Record<string, boolean>>({});
  const [featuredErrorById, setFeaturedErrorById] = useState<Record<string, string>>({});
  const [endpointUnavailable, setEndpointUnavailable] = useState(false);
  const [editingArtistId, setEditingArtistId] = useState<string | null>(null);

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

  const setFeaturedSaving = (artistId: string, value: boolean) => {
    setSavingFeaturedById((prev) => ({ ...prev, [artistId]: value }));
  };

  const setFeaturedError = (artistId: string, message: string) => {
    setFeaturedErrorById((prev) => ({ ...prev, [artistId]: message }));
  };

  const toggleFeatured = async (row: AdminArtistRow, nextValue: boolean) => {
    const previousValue = Boolean(row.is_featured);
    setRows((current) =>
      current.map((entry) =>
        entry.id === row.id ? { ...entry, is_featured: nextValue } : entry
      )
    );
    setFeaturedSaving(row.id, true);
    setFeaturedError(row.id, '');

    try {
      const response = await apiFetch(`/admin/artists/${row.id}`, {
        method: 'PATCH',
        body: { is_featured: nextValue },
      });
      const persisted = Boolean(response?.is_featured ?? response?.isFeatured ?? nextValue);
      setRows((current) =>
        current.map((entry) =>
          entry.id === row.id ? { ...entry, is_featured: persisted } : entry
        )
      );
      notify(
        `${withDash(row.name)} ${persisted ? 'marked as featured' : 'removed from featured'}.`,
        'success'
      );
    } catch (err: any) {
      setRows((current) =>
        current.map((entry) =>
          entry.id === row.id ? { ...entry, is_featured: previousValue } : entry
        )
      );
      const message = err?.message ?? 'Failed to update featured state.';
      setFeaturedError(row.id, message);
      notify(message, 'error');
    } finally {
      setFeaturedSaving(row.id, false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const columns: TableColumn<AdminArtistRow>[] = useMemo(
    () => [
      { header: 'Name', render: (row) => withDash(row.name) },
      { header: 'Handle', render: (row) => normalizeHandle(row.handle) },
      { header: 'Email', render: (row) => withDash(row.email) },
      { header: 'Status', render: (row) => normalizeStatusLabel(row.status) },
      {
        header: <span data-testid="admin-artist-featured-header">Featured</span>,
        render: (row) => {
          const isSaving = Boolean(savingFeaturedById[row.id]);
          const rowError = featuredErrorById[row.id] || '';
          return (
            <div
              data-testid={`admin-artist-featured-cell-${row.id}`}
              className="flex flex-col items-start gap-1"
              onClick={(event) => event.stopPropagation()}
            >
              <label className="inline-flex items-center gap-2 text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={Boolean(row.is_featured)}
                  disabled={isSaving}
                  data-testid={`admin-artist-featured-toggle-${row.id}`}
                  onClick={(event) => event.stopPropagation()}
                  onChange={(event) => {
                    event.stopPropagation();
                    void toggleFeatured(row, event.target.checked);
                  }}
                  className="h-4 w-4 rounded border border-white/20 bg-black/30 accent-emerald-400 disabled:opacity-60"
                />
                {isSaving ? 'Saving...' : row.is_featured ? 'Yes' : 'No'}
              </label>
              {rowError ? <p className="text-xs text-rose-300">{rowError}</p> : null}
            </div>
          );
        },
      },
      {
        header: 'Actions',
        render: (row) => (
          <div className="flex items-center justify-end gap-2 whitespace-nowrap">
            <Link
              to={`/partner/admin/artists/${row.id}`}
              onClick={(event) => event.stopPropagation()}
              className="rounded-lg border border-white/20 px-3 py-1 text-xs uppercase tracking-[0.25em] text-white"
            >
              View
            </Link>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setEditingArtistId(row.id);
              }}
              className="rounded-lg border border-white/20 px-3 py-1 text-xs uppercase tracking-[0.25em] text-white"
            >
              Edit
            </button>
          </div>
        ),
      },
    ],
    [featuredErrorById, navigate, savingFeaturedById]
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
      {success && (
        <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-200">
          {success}
        </div>
      )}

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

      <AdminArtistEditModal
        open={Boolean(editingArtistId)}
        artistId={editingArtistId}
        onClose={() => setEditingArtistId(null)}
        onSaved={async () => {
          setSuccess('Artist updated successfully.');
          await load();
        }}
      />
    </AppShell>
  );
}
