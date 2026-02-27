import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { fetchJson } from '../shared/api';
import { trackPageView } from '../shared/telemetry';
import EmptyState from '../components/ux/EmptyState';
import ErrorBanner from '../components/ux/ErrorBanner';
import LoadingSkeleton from '../components/ux/LoadingSkeleton';
import ProductCardPublic from '../components/public/ProductCardPublic';
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

export default function ArtistPage() {
  const { handle } = useParams<{ handle: string }>();
  const navigate = useNavigate();

  const [artist, setArtist] = useState<ArtistData | null>(null);
  const [products, setProducts] = useState<ProductCard[]>([]);
  const [activeDrop, setActiveDrop] = useState<DropCard | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

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
  const hasProducts = products.length > 0;

  useEffect(() => {
    if (artist) {
      trackPageView('Artist');
    }
  }, [artist]);

  return (
    <section>
      <header
        style={{
          padding: '1.5rem',
          borderRadius: 12,
          background: '#1b1b1b',
          border: '1px solid rgba(255,255,255,0.1)',
          marginBottom: '1.5rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div
            style={{
              width: 96,
              height: 96,
              borderRadius: 12,
              background: '#222',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.75rem',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
            }}
          >
            Cover
          </div>
          <div>
            <h1>{artist?.name ?? handle ?? 'Artist'}</h1>
            <p style={{ opacity: 0.7 }}>/{artist?.handle ?? handle}</p>
            <p style={{ marginTop: '0.5rem', opacity: 0.8 }}>
              {artist?.story ?? 'Story coming soon.'}
            </p>
          </div>
        </div>
      </header>

      <section style={{ marginBottom: '1.5rem' }}>
        <h2>Story</h2>
        {artist?.story ? (
          <p>{artist.story}</p>
        ) : (
          <p>
            Artists will share their story here once available. Stay tuned for
            behind-the-scenes notes.
          </p>
        )}
        {activeDrop && (
          <div style={{ marginTop: '1rem' }}>
            {activeDrop.handle ? (
              <Link
                to={`/drops/${activeDrop.handle}`}
                style={{
                  display: 'inline-block',
                  textDecoration: 'none',
                  color: '#fff',
                  border: '1px solid rgba(255,255,255,0.3)',
                  borderRadius: 999,
                  padding: '0.5rem 0.9rem',
                  fontSize: '0.8rem',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                }}
              >
                View drop
              </Link>
            ) : (
              <span
                style={{
                  display: 'inline-block',
                  color: 'rgba(255,255,255,0.6)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: 999,
                  padding: '0.5rem 0.9rem',
                  fontSize: '0.8rem',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  cursor: 'not-allowed',
                }}
              >
                Drop unavailable
              </span>
            )}
          </div>
        )}
      </section>

      <section>
        <div className="flex items-center justify-between">
          <h2>Products</h2>
        </div>
        {status === 'error' && (
          <ErrorBanner
            message={error ?? 'Failed to load artist products'}
            onRetry={loadData}
            className="mt-3"
          />
        )}
        {isLoading && <LoadingSkeleton count={3} className="mt-4" />}
        {!isLoading && !hasProducts && status !== 'error' && (
          <EmptyState message="This artist hasn’t released products yet." />
        )}
        {hasProducts && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '1rem',
              marginTop: '1rem',
            }}
          >
            {products.map((product) => (
              <ProductCardPublic key={product.id} product={product} href={`/products/${product.id}`} />
            ))}
          </div>
        )}
      </section>
    </section>
  );
}
