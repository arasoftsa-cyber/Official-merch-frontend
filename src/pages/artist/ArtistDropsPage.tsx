import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import DataTable, { TableColumn } from '../../components/ui/DataTable';
import LoadingSkeleton from '../../components/ux/LoadingSkeleton';
import ErrorBanner from '../../components/ux/ErrorBanner';
import { apiFetch } from '../../shared/api/http';
import { Page, Container } from '../../ui/Page';

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
                  className="rounded-lg border border-slate-200 dark:border-white/20 bg-white dark:bg-transparent px-2 py-1 text-[10px] uppercase tracking-wider text-slate-700 dark:text-white/90 hover:bg-slate-50 dark:hover:bg-white/10 disabled:opacity-60 transition-colors"
                >
                  {actionLoadingId === rowId ? 'Publishing...' : 'Publish'}
                </button>
                {productCount === 0 && (
                  <span className="text-[10px] uppercase tracking-tight text-amber-600 dark:text-amber-400">Add product</span>
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
                className="rounded-lg border border-slate-200 dark:border-white/20 bg-white dark:bg-transparent px-2 py-1 text-[10px] uppercase tracking-wider text-slate-700 dark:text-white/90 hover:bg-slate-50 dark:hover:bg-white/10 disabled:opacity-60 transition-colors"
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
    <Page>
      <Container className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-slate-500 dark:text-slate-400">Artist</p>
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Artist Drops</h1>
          </div>
          <Link
            to="/partner/artist"
            className="rounded-full border border-slate-200 dark:border-white/30 bg-white dark:bg-transparent px-4 py-2 text-xs uppercase tracking-[0.3em] text-slate-700 dark:text-white hover:bg-slate-50 dark:hover:bg-white/10 transition-colors"
          >
            Back to dashboard
          </Link>
        </div>

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
            className="rounded-xl border border-emerald-400/40 bg-emerald-50 dark:bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-100"
          >
            {notice}
          </p>
        )}
        {!loading && !hasRows && !error && (
          <p className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-950/60 p-4 text-xs text-slate-500 dark:text-white/70 italic">
            No drops yet.
          </p>
        )}
        {!loading && hasRows && (
          <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 shadow-lg">
            <div className="overflow-auto">
              <DataTable columns={columns} rows={rows} />
            </div>
          </div>
        )}
        <div className="mt-8 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
          <p className="text-[10px] uppercase tracking-[0.35em] text-slate-500 dark:text-slate-500">Data source</p>
          <p className="font-mono text-xs">GET /api/artist/drops</p>
        </div>
      </Container>
    </Page>
  );
}
