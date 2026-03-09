import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchJson } from '../shared/api/fetchJson';
import PublicCatalogCard from '../features/catalog/components/PublicCatalogCard';
import PublicCatalogEmptyState from '../features/catalog/components/PublicCatalogEmptyState';
import PublicCatalogGrid from '../features/catalog/components/PublicCatalogGrid';
import PublicCatalogGridSkeleton from '../features/catalog/components/PublicCatalogGridSkeleton';
import PublicCatalogHeader from '../features/catalog/components/PublicCatalogHeader';
import PublicCatalogPagination from '../features/catalog/components/PublicCatalogPagination';
import PublicCatalogToolbar, {
  PublicCatalogSortOption,
} from '../features/catalog/components/PublicCatalogToolbar';

type DropRow = {
  id: string;
  title: string;
  handle?: string;
  startsAt?: string;
  coverUrl?: string;
};

type DropSortKey = 'relevance' | 'newest' | 'title-asc';

const PAGE_SIZE = 12;
const DROP_SORT_OPTIONS: PublicCatalogSortOption[] = [
  { value: 'relevance', label: 'Curated relevance' },
  { value: 'newest', label: 'Newest drops' },
  { value: 'title-asc', label: 'Title: A to Z' },
];

export default function DropsPage() {
  const [drops, setDrops] = useState<DropRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [sortKey, setSortKey] = useState<DropSortKey>('relevance');
  const [page, setPage] = useState(1);
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
            coverUrl: row.coverUrl ?? row.cover_url ?? row.image_url ?? null,
          };
        })
        .filter((item: any): item is DropRow => Boolean(item)) as DropRow[];
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

  const displayedDrops = useMemo(() => {
    const normalizedSearch = searchText.trim().toLowerCase();

    const filtered = drops.filter((drop) => {
      if (!normalizedSearch) return true;
      return `${drop.title} ${drop.handle ?? ''}`.toLowerCase().includes(normalizedSearch);
    });

    if (sortKey === 'title-asc') {
      return [...filtered].sort((a, b) => a.title.localeCompare(b.title));
    }
    if (sortKey === 'newest') {
      return [...filtered].sort((a, b) => {
        const timeA = a.startsAt ? new Date(a.startsAt).getTime() : 0;
        const timeB = b.startsAt ? new Date(b.startsAt).getTime() : 0;
        return timeB - timeA;
      });
    }
    return filtered;
  }, [drops, searchText, sortKey]);

  const pageCount = Math.max(1, Math.ceil(displayedDrops.length / PAGE_SIZE));
  const pageItems = displayedDrops.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [searchText, sortKey]);

  useEffect(() => {
    setPage((current) => Math.min(current, pageCount));
  }, [pageCount]);

  return (
    <section className="space-y-8 py-4">
      <PublicCatalogHeader
        eyebrow="Releases"
        title="Drops"
        description="Browse current and upcoming drops from featured creators."
      />

      <PublicCatalogToolbar
        searchValue={searchText}
        onSearchChange={setSearchText}
        searchPlaceholder="Search drop title or handle..."
        resultCount={displayedDrops.length}
        sortValue={sortKey}
        onSortChange={(value) => setSortKey(value as DropSortKey)}
        sortOptions={DROP_SORT_OPTIONS}
      />

      {loading ? <PublicCatalogGridSkeleton count={8} /> : null}

      {!loading && error ? (
        <PublicCatalogEmptyState
          title="Something went wrong"
          message={error ? `Unable to load drops (${error}).` : 'Unable to load drops.'}
          actionLabel="Retry"
          onAction={loadDrops}
        />
      ) : null}

      {!loading && !error && drops.length === 0 ? (
        <PublicCatalogEmptyState
          title="No drops yet"
          message="Try again in a moment."
          actionLabel="Retry"
          onAction={loadDrops}
        />
      ) : null}

      {!loading && !error && drops.length > 0 ? (
        <>
          {displayedDrops.length === 0 ? (
            <PublicCatalogEmptyState
              title="No drop matches"
              message="Try a broader search term."
            />
          ) : (
            <>
              <PublicCatalogGrid>
                {pageItems.map((drop) => (
                  <PublicCatalogCard
                    key={drop.id}
                    kind="drop"
                    title={drop.title}
                    subtitle={drop.handle ? `/drops/${drop.handle}` : 'Featured drop'}
                    imageUrl={drop.coverUrl ?? undefined}
                    href={drop.handle ? `/drops/${drop.handle}` : undefined}
                    ctaLabel="View Drop"
                    unavailableLabel="Drop unavailable"
                    testId="drop-catalog-card"
                  />
                ))}
              </PublicCatalogGrid>
              <PublicCatalogPagination page={page} pageCount={pageCount} onPageChange={setPage} />
            </>
          )}
        </>
      ) : null}
    </section>
  );
}
