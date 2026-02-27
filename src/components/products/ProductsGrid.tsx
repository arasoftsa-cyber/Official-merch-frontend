import React from 'react';
import ProductCardPublic from '../public/ProductCardPublic';

type ProductsGridProps = {
  products: Array<{ id: string; [key: string]: any }>;
  emptyMessage?: string;
  className?: string;
};

export default function ProductsGrid({ products, emptyMessage, className }: ProductsGridProps) {
  if (products.length === 0) {
    return (
      <div
        className={`mt-6 grid grid-cols-1 gap-6 ${className ?? ''}`}
      >
        <div className="col-span-full rounded-2xl border border-white/10 bg-neutral-900/60 p-6 text-center text-sm text-neutral-300 shadow-lg shadow-black/40">
          {emptyMessage ?? 'No products to show right now.'}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 ${className ?? ''}`}
    >
      {products.map((product) => (
        <ProductCardPublic
          key={product.id}
          product={{
            id: String(product.id),
            title: String(product.title ?? `Product ${product.id}`),
            subtitle:
              typeof product.subtitle === 'string'
                ? product.subtitle
                : typeof product.artist === 'string'
                ? product.artist
                : undefined,
            card_image_url:
              typeof product.card_image_url === 'string'
                ? product.card_image_url
                : typeof product.cover_photo_url === 'string'
                ? product.cover_photo_url
                : typeof product.coverPhotoUrl === 'string'
                ? product.coverPhotoUrl
                : undefined,
            listing_photos: Array.isArray(product.listing_photos)
              ? product.listing_photos
              : Array.isArray(product.listingPhotos)
              ? product.listingPhotos
              : undefined,
            listingPhotos: Array.isArray(product.listingPhotos)
              ? product.listingPhotos
              : Array.isArray(product.listing_photos)
              ? product.listing_photos
              : undefined,
          }}
          href={`/products/${product.id}`}
        />
      ))}
    </div>
  );
}
