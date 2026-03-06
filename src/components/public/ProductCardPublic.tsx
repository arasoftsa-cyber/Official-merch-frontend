import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { resolveMediaUrl } from '../../shared/utils/media';

type ProductCardPublicModel = {
  id: string;
  title: string;
  subtitle?: string;
  artist?: string;
  handle?: string;
  card_image_url?: string;
  listing_photos?: string[];
  listingPhotos?: string[];
};

type ProductCardPublicProps = {
  product: ProductCardPublicModel;
  href?: string;
  onClick?: () => void;
};

export default function ProductCardPublic({ product, href, onClick }: ProductCardPublicProps) {
  const [imageLoadFailed, setImageLoadFailed] = useState(false);
  const productHref = href || `/products/${product.id}`;
  const cardImageUrl = useMemo(() => {
    const primary = resolveMediaUrl(product.card_image_url ?? null);
    if (primary) return primary;
    const listing =
      (Array.isArray(product.listing_photos) ? product.listing_photos[0] : '') ||
      (Array.isArray(product.listingPhotos) ? product.listingPhotos[0] : '');
    return resolveMediaUrl(listing || null) ?? '';
  }, [product.card_image_url, product.listingPhotos, product.listing_photos]);

  useEffect(() => {
    setImageLoadFailed(false);
  }, [product.id, cardImageUrl]);

  return (
    <Link
      to={productHref}
      onClick={onClick}
      data-testid="product-card"
      className="group block h-full overflow-hidden rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#1f1f1f] text-slate-900 dark:text-white transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 dark:hover:border-white/30 hover:bg-slate-50 dark:hover:bg-[#252525] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60 dark:focus-visible:ring-white/70 focus-visible:ring-offset-2"
      style={{ borderRadius: 12, textDecoration: 'none', display: 'block', minHeight: 320 }}
    >
      <div
        className="border-b border-slate-100 dark:border-white/[0.08] bg-slate-100 dark:bg-[#171717]"
        style={{ aspectRatio: '4 / 3', width: '100%', overflow: 'hidden' }}
      >
        {cardImageUrl && !imageLoadFailed ? (
          <img
            src={cardImageUrl}
            alt={`${product.title || 'Product'} image`}
            loading="lazy"
            decoding="async"
            onError={(event) => {
              event.currentTarget.onerror = null;
              setImageLoadFailed(true);
            }}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center bg-gradient-to-b from-slate-200 to-slate-100 dark:from-[#222] dark:to-[#181818] text-slate-400 dark:text-white/65"
            style={{ fontSize: '0.78rem', letterSpacing: '0.06em', textTransform: 'uppercase' }}
          >
            No image
          </div>
        )}
      </div>
      <div style={{ padding: '0.85rem 1rem 0.95rem', minHeight: 104 }}>
        <h3
          className="text-slate-900 dark:text-white"
          style={{
            margin: 0,
            fontSize: '0.98rem',
            lineHeight: 1.3,
            minHeight: '2.6em',
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          }}
        >
          {product.title}
        </h3>
        <p
          className="text-slate-500 dark:text-white/70"
          style={{
            margin: '0.45rem 0 0',
            fontSize: '0.82rem',
            minHeight: '2.4em',
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          }}
        >
          {product.subtitle || 'View product'}
        </p>
      </div>
    </Link>
  );
}
