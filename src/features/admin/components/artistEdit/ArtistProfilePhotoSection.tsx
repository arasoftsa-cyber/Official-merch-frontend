import React from 'react';
import AdminSectionSurface from '../shared/AdminSectionSurface';
import type { ArtistCapabilities, ArtistFormState } from './types';

type ArtistProfilePhotoSectionProps = {
  form: ArtistFormState;
  caps: ArtistCapabilities;
  saving: boolean;
  previewUrl: string;
  resolvedProfilePreviewUrl: string | null;
  onProfilePhotoUrlChange: (value: string) => void;
  onProfilePhotoFileChange: (file: File | null) => void;
};

export default function ArtistProfilePhotoSection({
  form,
  caps,
  saving,
  previewUrl,
  resolvedProfilePreviewUrl,
  onProfilePhotoUrlChange,
  onProfilePhotoFileChange,
}: ArtistProfilePhotoSectionProps) {
  return (
    <AdminSectionSurface as="fieldset" className="md:col-span-2">
      <legend className="px-2 text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 flex items-center gap-2">
        <span className="w-1 h-3 bg-indigo-500 dark:bg-emerald-500 rounded-full"></span>
        Profile Photo
      </legend>
      <div className="mt-4 flex flex-wrap items-start gap-6">
        <div className="h-24 w-24 overflow-hidden rounded-2xl border border-slate-200 dark:border-white/15 bg-white dark:bg-black/20 shadow-inner flex shrink-0 ring-4 ring-slate-100 dark:ring-white/5">
          {previewUrl || resolvedProfilePreviewUrl ? (
            <img
              src={previewUrl || resolvedProfilePreviewUrl || ''}
              alt="Profile preview"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[10px] font-bold uppercase tracking-widest text-slate-400">
              No photo
            </div>
          )}
        </div>

        <div className="min-w-[240px] flex-1 space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Image URL
            </label>
            <input
              value={form.profilePhotoUrl}
              onChange={(event) => onProfilePhotoUrlChange(event.target.value)}
              disabled={!caps.canEditProfilePhoto || saving}
              placeholder="https://example.com/photo.jpg"
              className="w-full rounded-xl border border-slate-200 dark:border-white/15 bg-white dark:bg-black/20 px-4 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 dark:focus:ring-emerald-500 outline-none transition disabled:bg-slate-100 dark:disabled:bg-black/30 disabled:text-slate-400"
            />
          </div>
          {caps.canUploadProfilePhoto && (
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Upload File
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={(event) => {
                  const file = event.target.files?.[0] || null;
                  onProfilePhotoFileChange(file);
                }}
                disabled={!caps.canEditProfilePhoto || saving}
                className="block w-full rounded-xl border border-slate-200 dark:border-white/15 bg-white dark:bg-black/20 px-4 py-2 text-sm text-slate-900 dark:text-white file:mr-4 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-indigo-50 dark:file:bg-emerald-500/10 file:text-indigo-600 dark:file:text-emerald-300 hover:file:bg-indigo-100 dark:hover:file:bg-emerald-500/20 cursor-pointer disabled:opacity-50"
              />
            </div>
          )}
          {!caps.canEditProfilePhoto && (
            <p className="text-[10px] lowercase text-slate-400 dark:text-slate-500 italic">
              Profile photo is not editable on this deployment.
            </p>
          )}
        </div>
      </div>
    </AdminSectionSurface>
  );
}
