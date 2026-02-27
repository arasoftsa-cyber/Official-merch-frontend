import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { resolveMediaUrl } from '../../shared/utils/media';

type ProductCardModel = {
  id: string;
  title?: string;
  artist?: string;
  brand?: string;
  cover_photo_url?: string;
  coverPhotoUrl?: string;
  listing_photos?: string[];
  listingPhotos?: string[];
  imageUrl?: string;
  primaryImageUrl?: string;
  thumbnailUrl?: string;
  description?: string;
};

type ProductCardProps = {
  product: ProductCardModel;
};

const resolveImage = (product: ProductCardModel) => {
  const coverPhotoUrl = resolveMediaUrl(product.cover_photo_url ?? product.coverPhotoUrl ?? null);
  if (coverPhotoUrl) return coverPhotoUrl;

  const listingPhotoUrl = resolveMediaUrl(
    (Array.isArray(product.listing_photos) ? product.listing_photos[0] : null) ??
      (Array.isArray(product.listingPhotos) ? product.listingPhotos[0] : null)
  );
  if (listingPhotoUrl) return listingPhotoUrl;

  return resolveMediaUrl(product.imageUrl ?? product.primaryImageUrl ?? product.thumbnailUrl ?? null);
};

export default function ProductCard({ product }: ProductCardProps) {
  const imageUrl = resolveImage(product);
  const [imageLoadFailed, setImageLoadFailed] = React.useState(false);

  React.useEffect(() => {
    setImageLoadFailed(false);
  }, [product.id, imageUrl]);

  const navigate = useNavigate();
  const subtitle = product.artist ?? product.brand ?? 'OfficialMerch';
  const productUrl = `/products/${product.id}`;
  const handleNavigate = () => {
    if (product.id) {
      navigate(productUrl);
    }
  };

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={handleNavigate}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          handleNavigate();
        }
      }}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/5 transition hover:border-indigo-400/60 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
    >
      <div className="relative w-full border-b border-white/5 bg-slate-900/60">
        <div className="aspect-[4/3] w-full overflow-hidden bg-gradient-to-b from-white/15 via-transparent to-black/30">
          {imageUrl && !imageLoadFailed ? (
            <img
              src={imageUrl}
              alt={product.title ?? 'Product'}
              onError={() => setImageLoadFailed(true)}
              className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-gradient-to-b from-white/10 to-black/30">
              <span className="flex h-12 w-12 items-center justify-center rounded-full border border-dashed border-white/30 text-xs uppercase tracking-[0.25em] text-white/60">
                IMG
              </span>
              <span className="h-2 w-3/4 rounded-full bg-white/10" />
              <span className="h-2 w-1/2 rounded-full bg-white/10" />
            </div>
          )}
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="text-sm uppercase tracking-[0.3em] text-neutral-400">{subtitle}</div>
        <h2 className="text-base font-semibold leading-snug text-white line-clamp-2">
          {product.title ?? 'Untitled release'}
        </h2>
        <p className="text-sm text-neutral-300 line-clamp-2">{product.description}</p>
      <div className="mt-auto flex flex-col gap-2">
        <Link
          to={productUrl}
          className="rounded-full bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-neutral-900 transition hover:bg-neutral-200"
        >
          View
        </Link>
      </div>
      </div>
    </article>
  );
}
