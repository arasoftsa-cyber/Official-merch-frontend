import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchJson } from '../shared/api';
import { API_BASE } from '../shared/api/http';
import { resolveMediaUrl } from '../shared/utils/media';
import EmptyState from '../components/ux/EmptyState';
import LoadingSkeleton from '../components/ux/LoadingSkeleton';
import PublicCardCover from '../components/public/PublicCardCover';

type ArtistRow = {
  handle: string;
  name: string;
  profilePhotoUrl?: string;
};

export default function ArtistsPage() {
  const [artists, setArtists] = useState<ArtistRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
          const profilePhotoUrl = profileCandidate
            ? resolveMediaUrl(profileCandidate, API_BASE)
            : String(value?.coverUrl ?? '').trim();
          if (!handle) return null;
          return { handle, name, profilePhotoUrl };
        })
        .filter((item): item is ArtistRow => Boolean(item));
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

  return (
    <main className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <div>
        <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Community</p>
        <h1 className="text-3xl font-semibold tracking-tight">Artists</h1>
        <p className="text-sm text-slate-300">
          Browse the creators pushing new drops in the OfficialMerch catalog.
        </p>
      </div>
      {loading && <LoadingSkeleton count={4} />}
      {!loading && error && (
        <EmptyState
          title="Something went wrong"
          message={error ? `Unable to load artists (${error}).` : 'Unable to load artists.'}
          actionLabel="Retry"
          onAction={loadArtists}
        />
      )}
      {!loading && !error && artists.length === 0 && (
        <EmptyState
          title="No artists yet"
          message="Try again in a moment."
          actionLabel="Retry"
          onAction={loadArtists}
        />
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {artists.map((artist) => (
          <article
            key={artist.handle}
            className="flex flex-col gap-3 rounded-2xl bg-white/5 p-4 ring-1 ring-white/10 transition hover:bg-white/10 hover:ring-white/30"
          >
            <PublicCardCover
              title={artist.name}
              subtitle={artist.handle}
              imageUrl={artist.profilePhotoUrl ?? undefined}
              imageAlt={`${artist.name || 'Artist'} profile photo`}
              kind="artist"
              className="aspect-[4/3] w-full rounded-xl"
            />
            <div>
              <p className="text-lg font-semibold">{artist.name}</p>
              <p className="text-xs uppercase tracking-[0.4em] text-slate-400">/{artist.handle}</p>
            </div>
            <p className="text-sm text-slate-400">
              Discover merch, drops, and stories curated by {artist.name}.
            </p>
            <div className="mt-auto">
              <Link
                to={`/artists/${artist.handle}`}
                className="inline-flex items-center justify-center rounded-full bg-indigo-500 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white transition hover:bg-indigo-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300/70"
              >
                View artist
              </Link>
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}
