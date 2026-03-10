import React from 'react';

type PublicCatalogGridSkeletonProps = {
  count?: number;
};

export default function PublicCatalogGridSkeleton({ count = 8 }: PublicCatalogGridSkeletonProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={`catalog-skeleton-${index}`}
          className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-white/5"
        >
          <div className="h-36 animate-pulse bg-slate-200 dark:bg-white/10" />
          <div className="space-y-2 p-4">
            <div className="h-4 w-3/4 animate-pulse rounded bg-slate-200 dark:bg-white/10" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-slate-200 dark:bg-white/10" />
            <div className="h-3 w-1/3 animate-pulse rounded bg-slate-200 dark:bg-white/10" />
          </div>
        </div>
      ))}
    </div>
  );
}
