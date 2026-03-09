import React from 'react';

type PublicCatalogPaginationProps = {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
};

export default function PublicCatalogPagination({
  page,
  pageCount,
  onPageChange,
}: PublicCatalogPaginationProps) {
  if (pageCount <= 1) return null;

  return (
    <div
      data-testid="public-catalog-pagination"
      className="flex flex-wrap items-center justify-center gap-3 text-xs uppercase tracking-[0.3em] text-slate-600 dark:text-slate-400"
    >
      <button
        type="button"
        onClick={() => onPageChange(Math.max(1, page - 1))}
        disabled={page === 1}
        className="rounded-full border border-slate-300 px-4 py-2 transition disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/20"
      >
        Previous
      </button>
      <span>
        Page {page} of {pageCount}
      </span>
      <button
        type="button"
        onClick={() => onPageChange(Math.min(pageCount, page + 1))}
        disabled={page === pageCount}
        className="rounded-full border border-slate-300 px-4 py-2 transition disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/20"
      >
        Next
      </button>
    </div>
  );
}
