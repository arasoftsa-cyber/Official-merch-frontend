import React from 'react';

type PublicCatalogEmptyStateProps = {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
};

export default function PublicCatalogEmptyState({
  title,
  message,
  actionLabel,
  onAction,
}: PublicCatalogEmptyStateProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center dark:border-white/10 dark:bg-white/5">
      <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h2>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{message}</p>
      {actionLabel && onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="mt-4 rounded-full border border-slate-300 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-700 transition hover:bg-slate-100 dark:border-white/25 dark:text-white dark:hover:bg-white/10"
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
