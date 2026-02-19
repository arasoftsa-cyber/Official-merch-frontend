import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchFeaturedDrops } from '../shared/api/appApi';
import { apiFetch } from '../shared/api/http';

type ArtistCard = {
  handle: string;
  name: string;
};

type ArtistRowState = {
  status: 'loading' | 'success' | 'error';
  items: ArtistCard[];
  error: string | null;
};

type DropCard = {
  id: string;
  handle: string;
  title: string;
  artistName: string | null;
};

type DropRowState = {
  status: 'loading' | 'success' | 'error';
  items: DropCard[];
  error: string | null;
};

const mapArtist = (row: any): ArtistCard | null => {
  const handle = String(row?.handle ?? row?.artistHandle ?? row?.slug ?? row?.id ?? '').trim();
  if (!handle) return null;
  const name = String(row?.name ?? row?.title ?? handle).trim();
  return { handle, name: name || handle };
};

const mapDrop = (row: any): DropCard | null => {
  const handle = String(row?.handle ?? row?.slug ?? '').trim();
  if (!handle) return null;
  const id = String(row?.id ?? handle).trim();
  const title = String(row?.title ?? row?.name ?? handle).trim();
  const artistNameRaw = row?.artistName ?? row?.artist_name ?? row?.artist?.name ?? row?.artist;
  const artistName =
    typeof artistNameRaw === 'string' && artistNameRaw.trim().length > 0
      ? artistNameRaw.trim()
      : null;

  return {
    id: id || handle,
    handle,
    title: title || handle,
    artistName,
  };
};

export default function LandingPage() {
  const [artistsRow, setArtistsRow] = useState<ArtistRowState>({
    status: 'loading',
    items: [],
    error: null,
  });
  const [dropsRow, setDropsRow] = useState<DropRowState>({
    status: 'loading',
    items: [],
    error: null,
  });

  const loadFeaturedArtists = useCallback(async () => {
    setArtistsRow({ status: 'loading', items: [], error: null });
    try {
      const payload = await apiFetch('/artists/featured');
      const artistRows = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.items)
          ? payload.items
          : [];
      const items = artistRows.map(mapArtist).filter((item): item is ArtistCard => Boolean(item));
      setArtistsRow({ status: 'success', items, error: null });
    } catch (error: any) {
      setArtistsRow({
        status: 'error',
        items: [],
        error: error?.message || 'Failed to load featured artists',
      });
    }
  }, []);

  const loadFeaturedDrops = useCallback(async () => {
    setDropsRow({ status: 'loading', items: [], error: null });
    try {
      const payload = await fetchFeaturedDrops<any>();
      const items = payload.map(mapDrop).filter((item): item is DropCard => Boolean(item));
      setDropsRow({ status: 'success', items, error: null });
    } catch (error: any) {
      setDropsRow({
        status: 'error',
        items: [],
        error: error?.message || 'Failed to load featured drops',
      });
    }
  }, []);

  useEffect(() => {
    void Promise.all([loadFeaturedArtists(), loadFeaturedDrops()]);
  }, [loadFeaturedArtists, loadFeaturedDrops]);

  return (
    <section className="py-8">
      <div className="mx-auto max-w-[820px] space-y-4">
        <p className="text-xs uppercase tracking-[0.25em] text-slate-400">OfficialMerch Public Release</p>
        <h1 className="text-4xl font-semibold leading-tight text-white">
          Limited drops curated with maker-first intent
        </h1>
        <p className="text-base text-slate-300">
          Discover artists across genres, preview upcoming drops, and support creators through high-contrast merch experiences.
        </p>
        <div className="flex flex-wrap gap-3 pt-2">
          <Link
            to="/products"
            className="inline-flex items-center justify-center rounded-full bg-white px-6 py-3 text-xs font-bold uppercase tracking-[0.12em] text-black"
            aria-label="Browse featured products"
          >
            Browse Products
          </Link>
          <Link
            to="/apply/artist"
            className="inline-flex items-center justify-center rounded-full border border-white/60 px-6 py-3 text-xs font-bold uppercase tracking-[0.12em] text-white"
            aria-label="Apply to join OfficialMerch"
          >
            Apply as Artist
          </Link>
        </div>
      </div>

      <div className="mt-12">
        <h2 className="text-2xl font-semibold text-white">Featured Artists</h2>

        {artistsRow.status === 'loading' && (
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={`artist-skeleton-${index}`} className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
                <div className="h-28 animate-pulse bg-white/10" />
                <div className="space-y-2 p-4">
                  <div className="h-4 w-3/4 animate-pulse rounded bg-white/10" />
                  <div className="h-3 w-1/2 animate-pulse rounded bg-white/10" />
                </div>
              </div>
            ))}
          </div>
        )}

        {artistsRow.status === 'error' && (
          <div className="mt-4 rounded-2xl border border-rose-400/35 bg-rose-500/10 p-4">
            <p className="text-sm text-rose-100">Failed to load featured artists ({artistsRow.error || 'unknown error'}).</p>
            <button
              type="button"
              onClick={loadFeaturedArtists}
              className="mt-3 rounded-lg border border-white/25 px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-white"
            >
              Retry
            </button>
          </div>
        )}

        {artistsRow.status === 'success' && artistsRow.items.length === 0 && (
          <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-6">
            <p className="text-sm text-slate-300">No featured artists yet. Come back soon.</p>
          </div>
        )}

        {artistsRow.status === 'success' && artistsRow.items.length > 0 && (
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {artistsRow.items.map((artist) => (
              <Link
                key={artist.handle}
                to={`/artists/${artist.handle}`}
                className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 transition hover:border-white/30"
              >
                <div className="flex h-28 items-center justify-center bg-white/10 text-xs font-bold uppercase tracking-[0.2em] text-slate-300">
                  Artist
                </div>
                <div className="space-y-1 p-4">
                  <p className="truncate text-sm font-semibold text-white">{artist.name}</p>
                  <p className="truncate text-xs text-slate-400">@{artist.handle}</p>
                  <p className="pt-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/80">View Artist</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="mt-10">
        <h2 className="text-2xl font-semibold text-white">Featured Drops</h2>

        {dropsRow.status === 'loading' && (
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={`drop-skeleton-${index}`} className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
                <div className="h-28 animate-pulse bg-white/10" />
                <div className="space-y-2 p-4">
                  <div className="h-4 w-3/4 animate-pulse rounded bg-white/10" />
                  <div className="h-3 w-1/2 animate-pulse rounded bg-white/10" />
                </div>
              </div>
            ))}
          </div>
        )}

        {dropsRow.status === 'error' && (
          <div className="mt-4 rounded-2xl border border-rose-400/35 bg-rose-500/10 p-4">
            <p className="text-sm text-rose-100">Failed to load featured drops ({dropsRow.error || 'unknown error'}).</p>
            <button
              type="button"
              onClick={loadFeaturedDrops}
              className="mt-3 rounded-lg border border-white/25 px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-white"
            >
              Retry
            </button>
          </div>
        )}

        {dropsRow.status === 'success' && dropsRow.items.length === 0 && (
          <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-6">
            <p className="text-sm text-slate-300">No drops are live yet. Check back shortly.</p>
          </div>
        )}

        {dropsRow.status === 'success' && dropsRow.items.length > 0 && (
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {dropsRow.items.map((drop) => (
              drop.handle ? (
                <Link
                  key={drop.id}
                  to={`/drops/${drop.handle}`}
                  className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 transition hover:border-white/30"
                >
                  <div className="flex h-28 items-center justify-center bg-white/10 text-xs font-bold uppercase tracking-[0.2em] text-slate-300">
                    Drop
                  </div>
                  <div className="space-y-1 p-4">
                    <p className="truncate text-sm font-semibold text-white">{drop.title}</p>
                    <p className="truncate text-xs text-slate-400">{drop.artistName || 'Featured Artist'}</p>
                    <p className="pt-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/80">View Drop</p>
                  </div>
                </Link>
              ) : (
                <div
                  key={drop.id}
                  className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 opacity-70"
                >
                  <div className="flex h-28 items-center justify-center bg-white/10 text-xs font-bold uppercase tracking-[0.2em] text-slate-300">
                    Drop
                  </div>
                  <div className="space-y-1 p-4">
                    <p className="truncate text-sm font-semibold text-white">{drop.title}</p>
                    <p className="truncate text-xs text-slate-400">{drop.artistName || 'Featured Artist'}</p>
                    <p className="pt-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/60">Drop unavailable</p>
                  </div>
                </div>
              )
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
