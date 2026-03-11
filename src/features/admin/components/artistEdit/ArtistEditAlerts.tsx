import React from 'react';

type ArtistEditAlertsProps = {
  error: string | null;
  info: string | null;
  loading: boolean;
};

export default function ArtistEditAlerts({ error, info, loading }: ArtistEditAlertsProps) {
  return (
    <>
      {error && (
        <p className="mb-4 rounded-lg bg-rose-50 dark:bg-rose-500/10 px-4 py-2 text-sm font-medium text-rose-600 dark:text-rose-300 border border-rose-200 dark:border-rose-500/20">
          {error}
        </p>
      )}
      {info && (
        <p className="mb-4 rounded-lg bg-sky-50 dark:bg-sky-500/10 px-4 py-2 text-sm font-medium text-sky-700 dark:text-sky-200 border border-sky-200 dark:border-sky-500/20">
          {info}
        </p>
      )}
      {loading && (
        <p className="text-sm text-slate-500 dark:text-slate-300 animate-pulse">
          Loading artist details...
        </p>
      )}
    </>
  );
}
