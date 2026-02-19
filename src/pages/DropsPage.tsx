import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { fetchJson } from '../shared/api';
import EmptyState from '../components/ux/EmptyState';
import LoadingSkeleton from '../components/ux/LoadingSkeleton';
import PublicCardCover from '../components/public/PublicCardCover';

type DropRow = {
  id: string;
  title: string;
  handle?: string;
  startsAt?: string;
  coverUrl?: string;
};

export default function DropsPage() {
  const [drops, setDrops] = useState<DropRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const loadDrops = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await fetchJson<{ items?: any[] }>('/drops/featured');
      const raw = Array.isArray(payload?.items) ? payload.items : [];
      const mapped = raw
        .map((row) => {
          if (!row?.id || !row?.title) return null;
          return {
            id: row.id,
            title: row.title,
            handle: row.handle,
            startsAt: row.starts_at,
            coverUrl: row.coverUrl ?? null,
          };
        })
        .filter((item): item is DropRow => Boolean(item));
      if (mountedRef.current) {
        setDrops(mapped);
      }
    } catch (err: any) {
      if (mountedRef.current) {
        setError(err?.message ?? 'Unable to load drops');
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    loadDrops();
    return () => {
      mountedRef.current = false;
    };
  }, [loadDrops]);

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Drops</h1>
        <p className="text-sm text-slate-300">Browse the latest drops from featured artists.</p>
      </div>
      {error && (
        <EmptyState
          title="Something went wrong"
          message={error ? `Unable to load drops (${error}).` : 'Unable to load drops.'}
          actionLabel="Retry"
          onAction={loadDrops}
        />
      )}
      {loading && <LoadingSkeleton count={3} />}
      {!loading && !error && drops.length === 0 && (
        <EmptyState
          title="No drops yet"
          message="Try again in a moment."
          actionLabel="Retry"
          onAction={loadDrops}
        />
      )}
      <ul className="space-y-3">
        {drops.map((drop) => (
          <li
            key={drop.id}
            className="rounded-xl bg-white/5 ring-1 ring-white/10 px-4 py-3 flex items-center justify-between gap-4"
          >
            <div className="flex items-center gap-4 min-w-0">
              <PublicCardCover
                title={drop.title}
                subtitle={drop.handle}
                imageUrl={drop.coverUrl ?? undefined}
                kind="drop"
                className="h-16 w-24 shrink-0 rounded-lg"
              />
              <div className="min-w-0">
                <p className="text-base font-semibold truncate">{drop.title}</p>
                {drop.handle && <p className="text-sm text-slate-400 truncate">/drops/{drop.handle}</p>}
              </div>
            </div>
            {drop.handle ? (
              <Link
                to={`/drops/${drop.handle}`}
                className="shrink-0 text-sm font-semibold uppercase tracking-[0.12em] text-indigo-300 hover:text-indigo-200"
              >
                View
              </Link>
            ) : (
              <span className="shrink-0 text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">
                Drop unavailable
              </span>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
