import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { fetchJson } from '../shared/api';
import { trackPageView } from '../shared/telemetry';
import EmptyState from '../components/ux/EmptyState';
import ErrorBanner from '../components/ux/ErrorBanner';
import LoadingSkeleton from '../components/ux/LoadingSkeleton';

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
  const [imageLoadFailedByProduct, setImageLoadFailedByProduct] = useState<Record<string, boolean>>({});
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
          const cardImageUrl =
            typeof entry?.card_image_url === 'string' ? entry.card_image_url.trim() : '';
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
      setImageLoadFailedByProduct({});
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
      setImageLoadFailedByProduct({});
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
              <Link
                to={`/products/${product.id}`}
                key={product.id}
                className="group block h-full overflow-hidden rounded-xl border border-white/10 bg-[#1f1f1f] transition-all duration-200 hover:-translate-y-0.5 hover:border-white/30 hover:bg-[#252525] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#111]"
                style={{
                  borderRadius: 12,
                  border: '1px solid rgba(255,255,255,0.1)',
                  textDecoration: 'none',
                  color: '#fff',
                  display: 'block',
                }}
              >
                <div
                  style={{
                    aspectRatio: '4 / 3',
                    width: '100%',
                    overflow: 'hidden',
                    borderBottom: '1px solid rgba(255,255,255,0.08)',
                    background: '#171717',
                  }}
                >
                  {product.card_image_url && !imageLoadFailedByProduct[product.id] ? (
                    <img
                      src={product.card_image_url}
                      alt={`${product.title || 'Product'} image`}
                      loading="lazy"
                      decoding="async"
                      onError={(event) => {
                        event.currentTarget.onerror = null;
                        setImageLoadFailedByProduct((prev) =>
                          prev[product.id] ? prev : { ...prev, [product.id]: true }
                        );
                      }}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        display: 'block',
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'rgba(255,255,255,0.65)',
                        fontSize: '0.78rem',
                        letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                        background: 'linear-gradient(180deg, #222 0%, #181818 100%)',
                      }}
                    >
                      No image
                    </div>
                  )}
                </div>
                <div style={{ padding: '0.85rem 1rem 0.95rem', minHeight: 76 }}>
                  <h3
                    style={{
                      margin: 0,
                      fontSize: '0.98rem',
                      lineHeight: 1.3,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {product.title}
                  </h3>
                  <p
                    style={{
                      margin: '0.45rem 0 0',
                      fontSize: '0.82rem',
                      opacity: 0.72,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {product.subtitle || 'View product'}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}
