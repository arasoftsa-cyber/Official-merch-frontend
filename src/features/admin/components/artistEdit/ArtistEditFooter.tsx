import React from 'react';

type ArtistEditFooterProps = {
  saving: boolean;
  loading: boolean;
  hasDetail: boolean;
  onClose: () => void;
  onSave: () => void;
};

export default function ArtistEditFooter({
  saving,
  loading,
  hasDetail,
  onClose,
  onSave,
}: ArtistEditFooterProps) {
  return (
    <div className="shrink-0 border-t border-slate-200 dark:border-white/10 px-6 py-4 bg-slate-50 dark:bg-white/5">
      <div className="flex gap-3 justify-end">
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl border border-slate-300 dark:border-white/20 bg-white dark:bg-white/5 px-6 py-2.5 text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition shadow-sm"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={saving || loading || !hasDetail}
          className="rounded-xl bg-indigo-600 dark:bg-emerald-500 px-8 py-2.5 text-sm font-bold uppercase tracking-widest text-white shadow-lg shadow-indigo-500/20 dark:shadow-emerald-500/20 hover:bg-indigo-700 dark:hover:bg-emerald-600 transition disabled:opacity-50 disabled:shadow-none"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}
