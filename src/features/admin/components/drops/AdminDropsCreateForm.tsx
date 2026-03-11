import React from 'react';
import type { ArtistOption } from './types';

type AdminDropsCreateFormProps = {
  title: string;
  selectedArtistId: string;
  creating: boolean;
  canCreate: boolean;
  artists: ArtistOption[];
  onSubmit: (event: React.FormEvent) => void;
  onTitleChange: (value: string) => void;
  onArtistChange: (value: string) => void;
};

export default function AdminDropsCreateForm({
  title,
  selectedArtistId,
  creating,
  canCreate,
  artists,
  onSubmit,
  onTitleChange,
  onArtistChange,
}: AdminDropsCreateFormProps) {
  return (
    <form
      onSubmit={onSubmit}
      className="grid gap-3 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 p-4 md:grid-cols-[1.2fr_1fr_auto] shadow-sm"
    >
      <input
        value={title}
        onChange={(event) => onTitleChange(event.target.value)}
        placeholder="Drop title"
        className="rounded-xl border border-slate-200 dark:border-white/15 bg-white dark:bg-black/30 px-3 py-2 text-sm text-slate-900 dark:text-white outline-none focus:border-indigo-400 dark:focus:border-white/40 transition"
      />
      <select
        aria-label="Artist"
        value={selectedArtistId}
        onChange={(event) => onArtistChange(event.target.value)}
        className="rounded-xl border border-slate-200 dark:border-white/15 bg-white dark:bg-black/30 px-3 py-2 text-sm text-slate-900 dark:text-white outline-none focus:border-indigo-400 dark:focus:border-white/40 transition appearance-none"
      >
        <option value="" disabled className="bg-white dark:bg-slate-950">
          Select artist
        </option>
        {artists.map((artist) => (
          <option key={artist.id} value={artist.id} className="bg-white dark:bg-slate-950">
            {artist.name}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={!canCreate}
        className="rounded-xl bg-slate-900 dark:bg-white px-6 py-2 text-sm font-black uppercase tracking-widest text-white dark:text-slate-950 transition-all hover:scale-[1.02] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {creating ? 'Creating...' : 'Create Drop'}
      </button>
    </form>
  );
}
