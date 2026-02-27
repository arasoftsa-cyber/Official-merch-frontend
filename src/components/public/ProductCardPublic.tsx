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
  );
}
