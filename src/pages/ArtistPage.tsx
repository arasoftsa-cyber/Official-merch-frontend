import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { fetchJson } from '../shared/api/fetchJson';
import { trackPageView } from '../shared/lib/telemetry';
import ErrorBanner from '../shared/components/ux/ErrorBanner';
import LoadingSkeleton from '../shared/components/ux/LoadingSkeleton';
import ProductCardPublic from '../features/catalog/components/ProductCardPublic';
import { resolveMediaUrl } from '../shared/utils/media';

type ArtistData = {
  id?: string;
  handle: string;
  name?: string;
  story?: string;
  coverImage?: string;
};

type ProductCard = {
  id: string;
  title: string;
  subtitle?: string;
  card_image_url: string;
};

type DropCard = {
  id: string;
  title?: string;
  handle?: string;
  artistId?: string;
  artistHandle?: string;
};

const PLACEHOLDER_PRODUCT_COUNT = 4;

export default function ArtistPage() {
  const { handle } = useParams<{ handle: string }>();
  const navigate = useNavigate();

  const [artist, setArtist] = useState<ArtistData | null>(null);
  const [products, setProducts] = useState<ProductCard[]>([]);
  const [activeDrop, setActiveDrop] = useState<DropCard | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [coverImageFailed, setCoverImageFailed] = useState(false);

  const loadData = useCallback(async () => {
    if (!handle) {
      return;
    }

    setStatus('loading');
    setError(null);

    try {
      const [artistPayload, productsPayload] = await Promise.all([
        fetchJson<{ artist?: any }>(`/artists/${handle}`),
        fetchJson<{ items?: any[] }>(`/artists/${handle}/products`),
      ]);

      if (!artistPayload?.artist) {
        throw new Error('artist_not_found');
      }

      const mappedArtist: ArtistData = {
        id: artistPayload.artist.id,
        handle: artistPayload.artist.handle || handle,
        name: artistPayload.artist.name ?? artistPayload.artist.title ?? handle,
        story:
          artistPayload.artist.story ??
          artistPayload.artist.bio ??
          artistPayload.artist.theme?.story ??
          artistPayload.artist.theme?.bio ??
          undefined,
        coverImage: artistPayload.artist.coverImageUrl ?? artistPayload.artist.heroImageUrl,
      };

      const productsData = productsPayload as any;
      const rawProducts = Array.isArray(productsData)
        ? productsData
        : Array.isArray(productsData?.items)
          ? productsData.items
          : Array.isArray(productsData?.shelf)
            ? productsData.shelf
            : Array.isArray(productsData?.products)
              ? productsData.products
              : [];

      const mappedProducts = rawProducts
        .map((entry) => {
          const cardImageUrl = resolveMediaUrl(entry?.card_image_url) ?? '';
          return {
            id: entry?.id ?? entry?.productId ?? entry?.sku,
            title: entry?.title ?? entry?.name ?? `Product ${(entry?.id ?? entry?.productId) ?? ''}`,
            subtitle:
              entry?.subtitle ??
              entry?.artistName ??
              entry?.artist?.name ??
              artistPayload.artist.name ??
              artistPayload.artist.handle ??
              'OfficialMerch',
            card_image_url: cardImageUrl,
          };
        })
        .filter((item): item is ProductCard => Boolean(item.id));

      if (import.meta.env.DEV) {
        console.log(
          '[artist page] product images',
          mappedProducts.map((p: any) => ({
            title: p.title || p.name,
            card_image_url: p.card_image_url,
          }))
        );
      }

      const dropsPayload = await fetchJson<{ items?: any[] }>('/drops/featured').catch(() => ({ items: [] }));
      const featuredDrops = Array.isArray(dropsPayload?.items) ? dropsPayload.items : [];
      const artistDrop = featuredDrops.find((drop) => {
        const dropArtistId = drop?.artistId ?? drop?.artist_id;
        const dropArtistHandle = drop?.artistHandle ?? drop?.artist_handle;
        return (
          (mappedArtist.id && dropArtistId === mappedArtist.id) ||
          (mappedArtist.handle && typeof dropArtistHandle === 'string' && dropArtistHandle === mappedArtist.handle)
        );
      });

      setArtist(mappedArtist);
      setProducts(mappedProducts);
      setActiveDrop(
        artistDrop
          ? {
            id: artistDrop.id,
            title: artistDrop.title,
            handle: artistDrop.handle,
            artistId: artistDrop.artistId ?? artistDrop.artist_id,
            artistHandle: artistDrop.artistHandle ?? artistDrop.artist_handle,
          }
          : null
      );
      setStatus('success');
    } catch (err: any) {
      if (err?.status === 404 || err?.message === 'artist_not_found') {
        navigate('/notfound');
        return;
      }

      setError(err?.message ?? 'Failed to load artist');
      setStatus('error');
      setArtist(null);
      setProducts([]);
      setActiveDrop(null);
    }
  }, [handle, navigate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const isLoading = status === 'loading';
  const coverImageUrl = resolveMediaUrl(artist?.coverImage ?? null) ?? '';
  const showCoverImage = Boolean(coverImageUrl) && !coverImageFailed;

  useEffect(() => {
    if (artist) {
      trackPageView('Artist');
    }
  }, [artist]);

  useEffect(() => {
    setCoverImageFailed(false);
  }, [coverImageUrl]);

  return (
    <section>
      <header className="p-6 rounded-xl bg-slate-50 dark:bg-[#1b1b1b] border border-slate-200 dark:border-white/10 mb-6">
        <div className="flex items-start gap-4">
          <div className="w-24 h-24 rounded-xl overflow-hidden border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-[#181818] flex-shrink-0">
            {showCoverImage ? (
              <img
                src={coverImageUrl}
                alt={`${artist?.name ?? handle ?? 'Artist'} cover`}
                onError={() => setCoverImageFailed(true)}
                className="w-full h-full object-cover block"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xs uppercase tracking-[0.1em] text-slate-500 dark:text-white/85 bg-gradient-to-br from-emerald-500/35 via-blue-500/20 to-slate-700/55">
                Cover
              </div>
            )}
          </div>
          <div className="flex flex-col justify-center min-h-24">
            <h1 className="text-xl font-semibold text-slate-900 dark:text-white m-0">{artist?.name ?? handle ?? 'Artist'}</h1>
            <p className="text-sm text-slate-500 dark:text-white/70">/{artist?.handle ?? handle}</p>
            <p
              className="mt-2 text-sm text-slate-600 dark:text-white/80 overflow-hidden"
              style={{
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                minHeight: '2.6em',
              }}
            >
              {artist?.story?.trim() ? artist.story : 'Story coming soon.'}
            </p>
          </div>
        </div>
      </header>

      <section className="mb-6">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Story</h2>
        <p className="text-slate-600 dark:text-white/80">{artist?.story?.trim() ? artist.story : 'Story coming soon.'}</p>

        <div className="mt-4 min-h-11 flex items-center">
          {activeDrop?.handle ? (
            <Link
              to={`/drops/${activeDrop.handle}`}
              className="inline-block no-underline text-slate-800 dark:text-white border border-slate-300 dark:border-white/30 rounded-full px-4 py-2 text-xs uppercase tracking-[0.08em] transition hover:bg-slate-100 dark:hover:bg-white/10"
            >
              View drop
            </Link>
          ) : (
            <button
              type="button"
              disabled
              aria-disabled="true"
              className="inline-block text-slate-400 dark:text-white/60 bg-transparent border border-slate-200 dark:border-white/20 rounded-full px-4 py-2 text-xs uppercase tracking-[0.08em] cursor-not-allowed"
            >
              Drop unavailable
            </button>
          )}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Products</h2>
        </div>

        {status === 'error' && (
          <ErrorBanner
            message={error ?? 'Failed to load artist products'}
            onRetry={loadData}
            className="mt-3"
          />
        )}

        {isLoading && <LoadingSkeleton count={3} className="mt-4" />}

        <div className="max-w-6xl mx-auto mt-4">
          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
            {!isLoading && products.length > 0
              ? products.map((product) => (
                <ProductCardPublic key={product.id} product={product} href={`/products/${product.id}`} />
              ))
              : null}

            {!isLoading && products.length === 0
              ? Array.from({ length: PLACEHOLDER_PRODUCT_COUNT }).map((_, index) => (
                <div
                  key={`artist-product-placeholder-${index}`}
                  className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.03] text-slate-400 dark:text-white/60 min-h-60 flex items-center justify-center p-4 text-center text-xs tracking-[0.04em] uppercase"
                >
                  Product coming soon
                </div>
              ))
              : null}
          </div>
        </div>
      </section>
    </section>
  );
}
