import React from 'react';
import AdminSectionSurface from '../shared/AdminSectionSurface';
import type { ArtistCapabilities, SocialRow } from './types';

type ArtistSocialsSectionProps = {
  socials: SocialRow[];
  caps: ArtistCapabilities;
  saving: boolean;
  onAddSocial: () => void;
  onRemoveSocial: (index: number) => void;
  onUpdateSocial: (index: number, key: keyof SocialRow, value: string) => void;
  focusOnPointerDown: (
    event: React.MouseEvent<HTMLSelectElement | HTMLTextAreaElement | HTMLInputElement>
  ) => void;
};

export default function ArtistSocialsSection({
  socials,
  caps,
  saving,
  onAddSocial,
  onRemoveSocial,
  onUpdateSocial,
  focusOnPointerDown,
}: ArtistSocialsSectionProps) {
  return (
    <AdminSectionSurface as="fieldset" className="md:col-span-2">
      <legend className="px-2 text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 flex items-center gap-2">
        <span className="w-1 h-3 bg-indigo-500 dark:bg-emerald-500 rounded-full"></span>
        Socials
      </legend>
      <div className="space-y-3">
        {socials.map((social, index) => (
          <div key={`social-${index}`} className="grid gap-3 md:grid-cols-[1fr_2fr_auto]">
            <input
              value={social.platform}
              onChange={(event) => onUpdateSocial(index, 'platform', event.target.value)}
              onMouseDown={focusOnPointerDown}
              disabled={!caps.canEditSocials || saving}
              placeholder="Platform"
              className="rounded-xl border border-slate-200 dark:border-white/15 bg-white dark:bg-black/20 px-4 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 dark:focus:ring-emerald-500 outline-none transition"
            />
            <input
              value={social.value}
              onChange={(event) => onUpdateSocial(index, 'value', event.target.value)}
              onMouseDown={focusOnPointerDown}
              disabled={!caps.canEditSocials || saving}
              placeholder="URL / Handle"
              className="rounded-xl border border-slate-200 dark:border-white/15 bg-white dark:bg-black/20 px-4 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 dark:focus:ring-emerald-500 outline-none transition"
            />
            <button
              type="button"
              onClick={() => onRemoveSocial(index)}
              disabled={!caps.canEditSocials || saving}
              className="rounded-xl border border-slate-300 dark:border-white/20 bg-white dark:bg-white/5 px-4 py-2 text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition shadow-sm"
            >
              Remove
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={onAddSocial}
        disabled={!caps.canEditSocials || saving}
        className="mt-4 rounded-xl border border-slate-300 dark:border-white/20 bg-white dark:bg-white/5 px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition shadow-sm inline-flex items-center gap-2"
      >
        <span className="text-base">+</span> Add Social
      </button>
    </AdminSectionSurface>
  );
}
