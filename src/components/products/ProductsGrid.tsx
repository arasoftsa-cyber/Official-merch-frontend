import React from 'react';
import ProductCard from './ProductCard';

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
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
