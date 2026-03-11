import React from 'react';

type ArtistEditHeaderProps = {
  onClose: () => void;
};

export default function ArtistEditHeader({ onClose }: ArtistEditHeaderProps) {
  return (
    <div className="shrink-0 border-b border-slate-200 dark:border-white/10 px-6 py-4 bg-slate-50 dark:bg-white/5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Edit artist</h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-slate-300 dark:border-white/20 bg-white dark:bg-white/5 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition shadow-sm"
        >
          Close
        </button>
      </div>
    </div>
  );
}
