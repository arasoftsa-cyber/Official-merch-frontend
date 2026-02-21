import React, { useEffect, useMemo, useState } from 'react';
import AppShell from '../../components/layout/AppShell';
import DataTable, { TableColumn } from '../../components/ui/DataTable';
import LoadingSkeleton from '../../components/ux/LoadingSkeleton';
import ErrorBanner from '../../components/ux/ErrorBanner';
import { apiFetch } from '../../shared/api/http';

type DropRecord = {
  id?: string;
  dropId?: string;
  title?: string;
  name?: string;
  status?: string;
  state?: string;
  startAt?: string;
  startsAt?: string;
  start?: string;
  endAt?: string;
  endsAt?: string;
  end?: string;
  updatedAt?: string;
  updated_at?: string;
  handle?: string;
  product_count?: number;
  productCount?: number;
  [key: string]: any;
};

export default function ArtistDropsPage() {
  const [rows, setRows] = useState<DropRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const loadDrops = async () => {
    setLoading(true);
    setError(null);
    try {
      const payload: any = await apiFetch('/api/artist/drops');
      const list = Array.isArray(payload) ? payload : Array.isArray(payload?.items) ? payload.items : [];
      setRows(list);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load drops.');
    } finally {
      setLoading(false);
    }
  };

  const runAction = async (row: DropRecord, action: 'publish' | 'unpublish') => {
    const dropKey = row.id ?? row.dropId ?? row.handle;
    if (!dropKey) {
      setError('Drop id is missing.');
      return;
    }

    setActionLoadingId(String(dropKey));
    setNotice(null);
    setError(null);
    try {
      await apiFetch(`/api/artist/drops/${encodeURIComponent(String(dropKey))}/${action}`, {
        method: 'POST',
      });
      setNotice(action === 'publish' ? 'Drop published.' : 'Drop unpublished.');
      await loadDrops();
    } catch (err: any) {
      setError(err?.message ?? `Failed to ${action} drop.`);
    } finally {
      setActionLoadingId(null);
    }
  };

  useEffect(() => {
    loadDrops();
  }, []);

  const columns: TableColumn<DropRecord>[] = useMemo(
    () => [
      {
        key: 'id',
        header: 'ID',
        render: (row) => row.id ?? row.dropId ?? '-',
      },
      {
        key: 'title',
        header: 'Title',
        render: (row) => row.title ?? row.name ?? '-',
      },
      {
        key: 'status',
        header: 'Status',
        render: (row) => (row.status ?? row.state ?? '-').toString(),
      },
      {
        key: 'start',
        header: 'Start',
        render: (row) => row.startAt ?? row.startsAt ?? row.start ?? '-',
      },
      {
        key: 'end',
        header: 'End',
        render: (row) => row.endAt ?? row.endsAt ?? row.end ?? '-',
      },
      {
        key: 'updated',
        header: 'Updated',
        render: (row) => row.updatedAt ?? row.updated_at ?? '-',
      },
      {
        key: 'actions',
        header: 'Actions',
        render: (row) => {
          const status = String(row.status ?? row.state ?? '').toLowerCase();
          const rowId = String(row.id ?? row.dropId ?? row.handle ?? '');
          const productCount = Number(row.product_count ?? row.productCount ?? 0);
          if (status === 'draft') {
            return (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => runAction(row, 'publish')}
                  disabled={actionLoadingId === rowId || productCount === 0}
                  className="rounded-lg border border-white/20 px-2 py-1 text-xs text-white/90 hover:bg-white/10 disabled:opacity-60"
                >
                  {actionLoadingId === rowId ? 'Publishing...' : 'Publish'}
                </button>
                {productCount === 0 && (
                  <span className="text-[11px] text-amber-300">Add a product to publish</span>
                )}
              </div>
            );
          }
          if (status === 'published') {
            return (
              <button
                type="button"
                onClick={() => runAction(row, 'unpublish')}
                disabled={actionLoadingId === rowId}
                className="rounded-lg border border-white/20 px-2 py-1 text-xs text-white/90 hover:bg-white/10 disabled:opacity-60"
              >
                {actionLoadingId === rowId ? 'Unpublishing...' : 'Unpublish'}
              </button>
            );
          }
          return '-';
        },
      },
    ],
    [actionLoadingId]
  );

  const hasRows = rows.length > 0;

  return (
    <AppShell title="Drops" subtitle="Read-only list">
      {loading && <LoadingSkeleton count={3} />}
      {error && (
        <ErrorBanner
          message={error}
          onRetry={() => {
            loadDrops();
          }}
        />
      )}
      {notice && (
        <p
          role="status"
          className="rounded-xl border border-emerald-400/40 bg-emerald-500/10 p-3 text-sm text-emerald-100"
        >
          {notice}
        </p>
      )}
      {!loading && !hasRows && !error && (
        <p className="rounded-xl border border-white/10 bg-slate-950/60 p-4 text-xs text-white/70">
          No drops yet.
        </p>
      )}
      {!loading && hasRows && (
        <div className="rounded-2xl border border-white/10 bg-white/5 shadow-lg">
          <div className="flex border-b border-white/10 px-4 py-3 text-[10px] uppercase tracking-[0.35em] text-slate-400">
            {['ID', 'Title', 'Status', 'Start', 'End', 'Updated', 'Actions'].map((label) => (
              <span key={label} className="flex-1">
                {label}
              </span>
            ))}
          </div>
          <div className="overflow-auto">
            <DataTable columns={columns} rows={rows} />
          </div>
        </div>
      )}
      <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
        <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Data source</p>
        <p>GET /api/artist/drops</p>
      </div>
    </AppShell>
  );
}
