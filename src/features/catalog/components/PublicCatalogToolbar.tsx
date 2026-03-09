import React from 'react';

export type PublicCatalogSortOption = {
  value: string;
  label: string;
};

type PublicCatalogToolbarProps = {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  resultCount: number;
  sortValue?: string;
  sortOptions?: PublicCatalogSortOption[];
  onSortChange?: (value: string) => void;
  sortLabel?: string;
};

export default function PublicCatalogToolbar({
  searchValue,
  onSearchChange,
  searchPlaceholder,
  resultCount,
  sortValue,
  sortOptions = [],
  onSortChange,
  sortLabel = 'Sort by',
}: PublicCatalogToolbarProps) {
  const hasSort = sortOptions.length > 0 && typeof sortValue === 'string' && Boolean(onSortChange);

  return (
    <section
      data-testid="public-catalog-toolbar"
      className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-lg shadow-black/5 dark:border-white/10 dark:bg-slate-900/60 dark:shadow-black/30 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
        <label htmlFor="public-catalog-search" className="sr-only">
          Search catalog
        </label>
        <input
          id="public-catalog-search"
          data-testid="public-catalog-search"
          type="search"
          value={searchValue}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={searchPlaceholder}
          className="flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-300 focus:outline-none dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:placeholder:text-white/40 dark:focus:border-white/30"
        />
        <div className="text-xs text-slate-600 dark:text-slate-400 sm:hidden">
          Showing {resultCount} match{resultCount === 1 ? '' : 'es'}
        </div>
      </div>

      <div className="flex items-center gap-3">
        {hasSort ? (
          <>
            <label
              htmlFor="public-catalog-sort"
              className="text-xs uppercase tracking-[0.3em] text-slate-600 dark:text-slate-400"
            >
              {sortLabel}
            </label>
            <select
              id="public-catalog-sort"
              data-testid="public-catalog-sort"
              value={sortValue}
              onChange={(event) => onSortChange?.(event.target.value)}
              style={{ colorScheme: 'light dark' }}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-slate-300 focus:outline-none dark:border-white/10 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-white/30"
            >
              {sortOptions.map((option) => (
                <option
                  key={option.value}
                  value={option.value}
                  className="bg-white text-slate-900 dark:bg-slate-900 dark:text-slate-100"
                >
                  {option.label}
                </option>
              ))}
            </select>
          </>
        ) : (
          <span className="hidden text-xs uppercase tracking-[0.3em] text-slate-600 dark:text-slate-400 sm:inline">
            {resultCount} match{resultCount === 1 ? '' : 'es'}
          </span>
        )}
      </div>
    </section>
  );
}
