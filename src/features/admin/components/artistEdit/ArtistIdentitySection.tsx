import React from 'react';
import type { ArtistCapabilities, ArtistFormState } from './types';

type ArtistIdentitySectionProps = {
  form: ArtistFormState;
  caps: ArtistCapabilities;
  emailEditable: boolean;
  statusOptions: string[];
  saving: boolean;
  fieldErrors: Record<string, string>;
  setForm: React.Dispatch<React.SetStateAction<ArtistFormState>>;
  focusOnPointerDown: (
    event: React.MouseEvent<HTMLSelectElement | HTMLTextAreaElement | HTMLInputElement>
  ) => void;
};

export default function ArtistIdentitySection({
  form,
  caps,
  emailEditable,
  statusOptions,
  saving,
  fieldErrors,
  setForm,
  focusOnPointerDown,
}: ArtistIdentitySectionProps) {
  return (
    <>
      <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        Name
        <input
          value={form.name}
          onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
          disabled={!caps.canEditName || saving}
          className="mt-1.5 w-full rounded-xl border border-slate-200 dark:border-white/15 bg-slate-50 dark:bg-black/20 px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 dark:focus:ring-emerald-500 outline-none transition disabled:opacity-50"
        />
        {fieldErrors.name && (
          <p className="mt-1 text-xs font-medium text-rose-600 dark:text-rose-300">{fieldErrors.name}</p>
        )}
      </label>

      <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        Handle
        <input
          value={form.handle ? `@${form.handle.replace(/^@+/, '')}` : '-'}
          onChange={(event) =>
            setForm((prev) => ({ ...prev, handle: event.target.value.replace(/^@+/, '') }))
          }
          disabled={!caps.canEditHandle || saving}
          className="mt-1.5 w-full rounded-xl border border-slate-200 dark:border-white/15 bg-slate-50 dark:bg-black/20 px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 dark:focus:ring-emerald-500 outline-none transition disabled:bg-slate-100 dark:disabled:bg-black/30 disabled:text-slate-400 dark:disabled:text-slate-500"
        />
        {!caps.canEditHandle && (
          <p className="mt-1 text-[10px] lowercase text-slate-400 dark:text-slate-500">
            Handle cannot be changed after creation.
          </p>
        )}
        {fieldErrors.handle && (
          <p className="mt-1 text-xs font-medium text-rose-600 dark:text-rose-300">{fieldErrors.handle}</p>
        )}
      </label>

      <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        Email
        <input
          value={emailEditable ? form.email : form.email || '-'}
          onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
          disabled={!emailEditable || saving}
          className="mt-1.5 w-full rounded-xl border border-slate-200 dark:border-white/15 bg-slate-50 dark:bg-black/20 px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 dark:focus:ring-emerald-500 outline-none transition disabled:bg-slate-100 dark:disabled:bg-black/30 disabled:text-slate-400 dark:disabled:text-slate-500"
        />
        {!emailEditable && (
          <p className="mt-1 text-[10px] lowercase text-slate-400 dark:text-slate-500">
            Email is not editable for this artist.
          </p>
        )}
        {fieldErrors.email && (
          <p className="mt-1 text-xs font-medium text-rose-600 dark:text-rose-300">{fieldErrors.email}</p>
        )}
      </label>

      <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        Status
        <select
          value={form.status ?? ''}
          onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value }))}
          onMouseDown={focusOnPointerDown}
          disabled={!caps.canEditStatus || saving}
          className="mt-1.5 w-full rounded-xl border border-slate-200 dark:border-white/15 bg-slate-50 dark:bg-black/20 px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 dark:focus:ring-emerald-500 outline-none transition appearance-none cursor-pointer"
        >
          {statusOptions.map((entry) => (
            <option key={entry} value={entry} className="dark:bg-slate-900 text-slate-900 dark:text-white">
              {entry}
            </option>
          ))}
        </select>
        {fieldErrors.status && (
          <p className="mt-1 text-xs font-medium text-rose-600 dark:text-rose-300">{fieldErrors.status}</p>
        )}
      </label>

      <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        Featured
        <div className="mt-2 flex items-center gap-3 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/15 px-4 py-2.5 cursor-pointer hover:bg-slate-100 dark:hover:bg-white/10 transition">
          <input
            type="checkbox"
            data-testid="admin-artist-featured-modal-toggle"
            checked={Boolean(form.is_featured)}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, is_featured: event.target.checked }))
            }
            disabled={!caps.canEditFeatured || saving}
            className="h-5 w-5 rounded border border-slate-300 dark:border-white/20 bg-white dark:bg-black/30 accent-emerald-500 disabled:opacity-50 transition"
          />
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
            {form.is_featured ? 'Featured artist' : 'Not featured'}
          </span>
        </div>
      </label>

      <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 md:col-span-2">
        Phone
        <input
          value={form.phone}
          onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
          disabled={!caps.canEditPhone || saving}
          className="mt-1.5 w-full rounded-xl border border-slate-200 dark:border-white/15 bg-slate-50 dark:bg-black/20 px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 dark:focus:ring-emerald-500 outline-none transition disabled:bg-slate-100 dark:disabled:bg-black/30 disabled:text-slate-400 dark:disabled:text-slate-500"
        />
      </label>

      <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 md:col-span-2">
        About
        <textarea
          value={form.about ?? ''}
          onChange={(event) => setForm((prev) => ({ ...prev, about: event.target.value }))}
          onMouseDown={focusOnPointerDown}
          rows={4}
          disabled={!caps.canEditAboutMe || saving}
          className="mt-1.5 w-full rounded-xl border border-slate-200 dark:border-white/15 bg-slate-50 dark:bg-black/20 px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 dark:focus:ring-emerald-500 outline-none transition min-h-[100px]"
        />
      </label>

      <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 md:col-span-2">
        Message For Fans
        <textarea
          value={form.message_for_fans ?? ''}
          onChange={(event) =>
            setForm((prev) => ({ ...prev, message_for_fans: event.target.value }))
          }
          onMouseDown={focusOnPointerDown}
          rows={3}
          disabled={!caps.canEditMessageForFans || saving}
          className="mt-1.5 w-full rounded-xl border border-slate-200 dark:border-white/15 bg-slate-50 dark:bg-black/20 px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 dark:focus:ring-emerald-500 outline-none transition min-h-[80px]"
        />
      </label>
    </>
  );
}
