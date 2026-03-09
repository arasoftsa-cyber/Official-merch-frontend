import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchJson } from '../shared/api/fetchJson';
import { resolveMediaUrl } from '../shared/utils/media';
import PublicCatalogCard from '../features/catalog/components/PublicCatalogCard';
import PublicCatalogEmptyState from '../features/catalog/components/PublicCatalogEmptyState';
import PublicCatalogGrid from '../features/catalog/components/PublicCatalogGrid';
import PublicCatalogGridSkeleton from '../features/catalog/components/PublicCatalogGridSkeleton';
import PublicCatalogHeader from '../features/catalog/components/PublicCatalogHeader';
import PublicCatalogPagination from '../features/catalog/components/PublicCatalogPagination';
import PublicCatalogToolbar, {
  PublicCatalogSortOption,
} from '../features/catalog/components/PublicCatalogToolbar';

type ArtistRow = {
  handle: string;
  name: string;
  profilePhotoUrl?: string;
};

type ArtistSortKey = 'relevance' | 'name-asc' | 'name-desc';

const PAGE_SIZE = 12;
const ARTIST_SORT_OPTIONS: PublicCatalogSortOption[] = [
  { value: 'relevance', label: 'Curated relevance' },
  { value: 'name-asc', label: 'Name: A to Z' },
  { value: 'name-desc', label: 'Name: Z to A' },
];

export default function ArtistsPage() {
  const [artists, setArtists] = useState<ArtistRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [sortKey, setSortKey] = useState<ArtistSortKey>('relevance');
  const [page, setPage] = useState(1);
  const mountedRef = useRef(true);

  const loadArtists = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await fetchJson<{ items?: any[]; artists?: any[]; data?: any[] }>('/artists');
      const raw =
        (Array.isArray(payload?.items) && payload.items) ||
        (Array.isArray(payload?.artists) && payload.artists) ||
        (Array.isArray(payload?.data) && payload.data) ||
        [];
      const mapped = raw
        .map((value) => {
          const handle = value?.handle ?? value?.artistHandle ?? value?.id;
          const name = value?.name ?? value?.title ?? handle;
          const profileCandidate =
            value?.profile_photo_url ?? value?.profilePhotoUrl ?? null;
          const profilePhotoUrl =
            resolveMediaUrl(profileCandidate) ??
            resolveMediaUrl(value?.coverUrl) ??
            '';
          if (!handle) return null;
          return { handle, name, profilePhotoUrl };
        })
        .filter((item: any): item is ArtistRow => Boolean(item)) as ArtistRow[];
      if (mountedRef.current) {
        setArtists(mapped);
      }
    } catch (err: any) {
      if (mountedRef.current) {
        setError(err?.message ?? 'Unable to load artists');
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    loadArtists();
    return () => {
      mountedRef.current = false;
    };
  }, [loadArtists]);

  const displayedArtists = useMemo(() => {
    const normalizedSearch = searchText.trim().toLowerCase();

    const filtered = artists.filter((artist) => {
      if (!normalizedSearch) return true;
      return `${artist.name} ${artist.handle}`.toLowerCase().includes(normalizedSearch);
    });

    if (sortKey === 'name-asc') {
      return [...filtered].sort((a, b) => a.name.localeCompare(b.name));
    }
    if (sortKey === 'name-desc') {
      return [...filtered].sort((a, b) => b.name.localeCompare(a.name));
    }
    return filtered;
  }, [artists, searchText, sortKey]);

  const pageCount = Math.max(1, Math.ceil(displayedArtists.length / PAGE_SIZE));
  const pageItems = displayedArtists.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [searchText, sortKey]);

  useEffect(() => {
    setPage((current) => Math.min(current, pageCount));
  }, [pageCount]);

  return (
    <section className="space-y-8 py-4">
      <PublicCatalogHeader
        eyebrow="Community"
        title="Artists"
        description="Browse creators pushing new drops in the OfficialMerch storefront."
      />

      <PublicCatalogToolbar
        searchValue={searchText}
        onSearchChange={setSearchText}
        searchPlaceholder="Search artist name or handle..."
        resultCount={displayedArtists.length}
        sortValue={sortKey}
        onSortChange={(value) => setSortKey(value as ArtistSortKey)}
        sortOptions={ARTIST_SORT_OPTIONS}
      />

      {loading ? <PublicCatalogGridSkeleton count={8} /> : null}

      {!loading && error ? (
        <PublicCatalogEmptyState
          title="Something went wrong"
          message={error ? `Unable to load artists (${error}).` : 'Unable to load artists.'}
          actionLabel="Retry"
          onAction={loadArtists}
        />
      ) : null}

      {!loading && !error && artists.length === 0 ? (
        <PublicCatalogEmptyState
          title="No artists yet"
          message="Try again in a moment."
          actionLabel="Retry"
          onAction={loadArtists}
        />
      ) : null}

      {!loading && !error && artists.length > 0 ? (
        <>
          {displayedArtists.length === 0 ? (
            <PublicCatalogEmptyState
              title="No artist matches"
              message="Try a broader search term."
            />
          ) : (
            <>
              <PublicCatalogGrid>
                {pageItems.map((artist) => (
                  <PublicCatalogCard
                    key={artist.handle}
                    kind="artist"
                    title={artist.name}
                    subtitle={`@${artist.handle}`}
                    imageUrl={artist.profilePhotoUrl ?? undefined}
                    imageAlt={`${artist.name || 'Artist'} profile photo`}
                    href={`/artists/${artist.handle}`}
                    ctaLabel="View Artist"
                    testId="artist-catalog-card"
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
