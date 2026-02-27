import React, { useEffect, useMemo, useState } from 'react';
import { apiFetch, apiFetchForm } from '../../shared/api/http';
import { resolveMediaUrl } from '../../shared/utils/media';

type SocialRow = {
  platform: string;
  value: string;
};

type ArtistCapabilities = {
  canEditName: boolean;
  canEditHandle: boolean;
  canEditEmail: boolean;
  canEditStatus: boolean;
  canEditPhone: boolean;
  canEditAboutMe: boolean;
  canEditMessageForFans: boolean;
  canEditSocials: boolean;
  canEditProfilePhoto: boolean;
  canUploadProfilePhoto: boolean;
};

type ArtistDetail = {
  id: string;
  name: string;
  handle: string;
  email: string;
  status: string;
  is_featured: boolean;
  phone: string;
  about: string;
  message_for_fans: string;
  profilePhotoUrl: string;
  socials: SocialRow[];
  statusOptions: string[];
  capabilities: ArtistCapabilities;
};

type Props = {
  open: boolean;
  artistId: string | null;
  onClose: () => void;
  onSaved?: () => void | Promise<void>;
};

type ArtistFormState = {
  name: string;
  handle: string;
  email: string;
  status: string;
  is_featured: boolean;
  phone: string;
  about: string;
  message_for_fans: string;
  socials: SocialRow[];
  profilePhotoUrl: string;
};

const DEFAULT_CAPABILITIES: ArtistCapabilities = {
  canEditName: true,
  canEditHandle: false,
  canEditEmail: true,
  canEditStatus: true,
  canEditPhone: true,
  canEditAboutMe: true,
  canEditMessageForFans: true,
  canEditSocials: true,
  canEditProfilePhoto: true,
  canUploadProfilePhoto: false,
};

const DEFAULT_STATUS_OPTIONS = ['approved', 'active', 'inactive', 'rejected'];

const normalizeDetail = (payload: any): ArtistDetail => {
  const row = payload?.item ?? payload?.artist ?? payload ?? {};
  const rawSocials = Array.isArray(row?.socials) ? row.socials : [];
  const socials = rawSocials
    .map((entry: any) => ({
      platform: String(entry?.platform ?? entry?.name ?? '').trim(),
      value: String(
        entry?.value ?? entry?.profileLink ?? entry?.url ?? entry?.link ?? entry?.handle ?? ''
      ).trim(),
    }))
    .filter((entry: SocialRow) => entry.platform || entry.value);

  const statusOptions = Array.isArray(row?.statusOptions)
    ? row.statusOptions.map((s: any) => String(s || '').trim().toLowerCase()).filter(Boolean)
    : DEFAULT_STATUS_OPTIONS;

  return {
    id: String(row?.id ?? ''),
    name: String(row?.name ?? row?.artist_name ?? '').trim(),
    handle: String(row?.handle ?? '').replace(/^@+/, '').trim(),
    email: String(row?.email ?? row?.contact_email ?? '').trim(),
    status: String(row?.status ?? '').trim().toLowerCase() || 'active',
    is_featured: Boolean(row?.is_featured ?? row?.isFeatured),
    phone: String(row?.phone ?? row?.contact_phone ?? '').trim(),
    about: String(row?.about ?? row?.aboutMe ?? row?.about_me ?? '').trim(),
    message_for_fans: String(
      row?.message_for_fans ?? row?.messageForFans ?? ''
    ).trim(),
    profilePhotoUrl: resolveMediaUrl(String(row?.profilePhotoUrl ?? row?.profile_photo_url ?? '').trim() || null) ?? '',
    socials,
    statusOptions: statusOptions.length ? statusOptions : DEFAULT_STATUS_OPTIONS,
    capabilities: { ...DEFAULT_CAPABILITIES, ...(row?.capabilities || {}) },
  };
};

const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const EMPTY_SOCIAL_ROW: SocialRow = { platform: '', value: '' };

const createInitialFormState = (): ArtistFormState => ({
  name: '',
  handle: '',
  email: '',
  status: 'active',
  is_featured: false,
  phone: '',
  about: '',
  message_for_fans: '',
  socials: [EMPTY_SOCIAL_ROW],
  profilePhotoUrl: '',
});

export default function AdminArtistEditModal({ open, artistId, onClose, onSaved }: Props) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [detail, setDetail] = useState<ArtistDetail | null>(null);
  const [form, setForm] = useState<ArtistFormState>(createInitialFormState);
  const [profilePhotoFile, setProfilePhotoFile] = useState<File | null>(null);

  useEffect(() => {
    if (!open || !artistId) return;
    let active = true;
    (async () => {
      setLoading(true);
      setSaving(false);
      setError(null);
      setFieldErrors({});
      setProfilePhotoFile(null);
      try {
        const payload = await apiFetch(`/admin/artists/${artistId}`);
        if (!active) return;
        const normalized = normalizeDetail(payload);
        setDetail(normalized);
        setForm({
          name: normalized.name,
          handle: normalized.handle,
          email: normalized.email,
          status: normalized.status,
          is_featured: normalized.is_featured,
          phone: normalized.phone,
          about: normalized.about,
          message_for_fans: normalized.message_for_fans,
          socials: normalized.socials.length ? normalized.socials : [EMPTY_SOCIAL_ROW],
          profilePhotoUrl: normalized.profilePhotoUrl,
        });
      } catch (err: any) {
        if (!active) return;
        setError(err?.message ?? 'Failed to load artist details.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [open, artistId]);

  const previewUrl = useMemo(() => {
    if (!profilePhotoFile) return '';
    return URL.createObjectURL(profilePhotoFile);
  }, [profilePhotoFile]);
  const resolvedProfilePreviewUrl = resolveMediaUrl(form.profilePhotoUrl);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  if (!open) return null;

  const caps = detail?.capabilities || DEFAULT_CAPABILITIES;
  const emailEditable = caps.canEditEmail;
  const statusOptions = detail?.statusOptions?.length ? detail.statusOptions : DEFAULT_STATUS_OPTIONS;

  const addSocial = () => {
    setForm((prev) => ({ ...prev, socials: [...prev.socials, { ...EMPTY_SOCIAL_ROW }] }));
  };

  const removeSocial = (index: number) => {
    setForm((prev) => ({
      ...prev,
      socials: prev.socials.filter((_, i) => i !== index),
    }));
  };

  const updateSocial = (index: number, key: keyof SocialRow, nextValue: string) => {
    setForm((prev) => ({
      ...prev,
      socials: prev.socials.map((entry, i) => (i === index ? { ...entry, [key]: nextValue } : entry)),
    }));
  };

  const save = async () => {
    if (!artistId || !detail) return;

    const nextErrors: Record<string, string> = {};
    if (caps.canEditName && form.name.trim().length < 2) {
      nextErrors.name = 'Name must be at least 2 characters.';
    }
    if (caps.canEditHandle && !form.handle.trim()) {
      nextErrors.handle = 'Handle cannot be empty.';
    }
    if (emailEditable && form.email.trim() && !isValidEmail(form.email.trim())) {
      nextErrors.email = 'Please enter a valid email.';
    }
    if (!form.status.trim()) {
      nextErrors.status = 'Status is required.';
    }
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setError('Please fix the highlighted fields.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const payload: Record<string, any> = {};
      if (caps.canEditName) payload.name = form.name.trim();
      if (caps.canEditHandle) payload.handle = form.handle.trim().replace(/^@+/, '');
      if (emailEditable) payload.email = form.email.trim().toLowerCase();
      payload.status = form.status.trim().toLowerCase();
      payload.is_featured = Boolean(form.is_featured);
      if (caps.canEditPhone) payload.phone = form.phone.trim();
      payload.about = form.about.trim();
      payload.message_for_fans = form.message_for_fans.trim();
      payload.socials = form.socials
        .map((entry) => ({
          platform: String(entry.platform || '').trim(),
          value: String(entry.value || '').trim(),
        }))
        .filter((entry) => entry.platform || entry.value);

      if (caps.canEditProfilePhoto) {
        if (profilePhotoFile && caps.canUploadProfilePhoto) {
          const fd = new FormData();
          fd.append('file', profilePhotoFile);
          const upload = await apiFetchForm('/media-assets', fd, { method: 'POST' });
          const uploadedUrl = String(upload?.publicUrl || '').trim();
          if (uploadedUrl) payload.profile_photo_url = uploadedUrl;
          if (upload?.id) payload.profile_photo_media_asset_id = upload.id;
        } else {
          payload.profile_photo_url = form.profilePhotoUrl.trim();
        }
      }

      await apiFetch(`/admin/artists/${artistId}`, {
        method: 'PATCH',
        body: payload,
      });

      await onSaved?.();
      onClose();
    } catch (err: any) {
      setError(err?.message ?? 'Failed to save artist.');
    } finally {
      setSaving(false);
    }
  };

  const focusOnPointerDown = (
    event: React.MouseEvent<HTMLSelectElement | HTMLTextAreaElement | HTMLInputElement>
  ) => {
    const target = event.currentTarget;
    if (document.activeElement !== target) {
      requestAnimationFrame(() => target.focus());
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="relative z-10 pointer-events-auto max-h-[90vh] w-full max-w-3xl space-y-4 overflow-y-auto rounded-2xl border border-white/10 bg-slate-950/95 p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg text-white">Edit artist</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/20 px-2 py-1 text-xs text-white"
          >
            Close
          </button>
        </div>

        {error && <p className="text-sm text-rose-300">{error}</p>}
        {loading && <p className="text-sm text-slate-300">Loading artist details...</p>}

        {!loading && detail && (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="text-sm text-white">
                Name
                <input
                  value={form.name}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, name: event.target.value }))
                  }
                  disabled={!caps.canEditName || saving}
                  className="mt-2 w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-sm text-white"
                />
                {fieldErrors.name && <p className="mt-1 text-xs text-rose-300">{fieldErrors.name}</p>}
              </label>

              <label className="text-sm text-white">
                Handle
                <input
                  value={form.handle ? `@${form.handle.replace(/^@+/, '')}` : '-'}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      handle: event.target.value.replace(/^@+/, ''),
                    }))
                  }
                  disabled={!caps.canEditHandle || saving}
                  className="mt-2 w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-sm text-white disabled:bg-black/30 disabled:text-slate-300"
                />
                {!caps.canEditHandle && (
                  <p className="mt-1 text-xs text-slate-400">Handle cannot be changed after creation.</p>
                )}
                {fieldErrors.handle && <p className="mt-1 text-xs text-rose-300">{fieldErrors.handle}</p>}
              </label>

              <label className="text-sm text-white">
                Email
                <input
                  value={emailEditable ? form.email : form.email || '-'}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, email: event.target.value }))
                  }
                  disabled={!emailEditable || saving}
                  className="mt-2 w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-sm text-white disabled:bg-black/30 disabled:text-slate-300"
                />
                {!emailEditable && (
                  <p className="mt-1 text-xs text-slate-400">Email is not editable for this artist.</p>
                )}
                {fieldErrors.email && <p className="mt-1 text-xs text-rose-300">{fieldErrors.email}</p>}
              </label>

              <label className="text-sm text-white">
                Status
                <select
                  value={form.status ?? ''}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, status: event.target.value }))
                  }
                  onMouseDown={focusOnPointerDown}
                  className="mt-2 w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-sm text-white"
                >
                  {statusOptions.map((entry) => (
                    <option key={entry} value={entry}>
                      {entry}
                    </option>
                  ))}
                </select>
                {fieldErrors.status && <p className="mt-1 text-xs text-rose-300">{fieldErrors.status}</p>}
              </label>

              <label className="text-sm text-white">
                Featured
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="checkbox"
                    data-testid="admin-artist-featured-modal-toggle"
                    checked={Boolean(form.is_featured)}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, is_featured: event.target.checked }))
                    }
                    disabled={saving}
                    className="h-4 w-4 rounded border border-white/20 bg-black/20 accent-emerald-400 disabled:opacity-50"
                  />
                  <span className="text-xs text-slate-300">
                    {form.is_featured ? 'Featured artist' : 'Not featured'}
                  </span>
                </div>
              </label>

              <label className="text-sm text-white md:col-span-2">
                Phone
                <input
                  value={form.phone}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, phone: event.target.value }))
                  }
                  disabled={!caps.canEditPhone || saving}
                  className="mt-2 w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-sm text-white disabled:bg-black/30 disabled:text-slate-300"
                />
              </label>

              <label className="text-sm text-white md:col-span-2">
                About
                <textarea
                  value={form.about ?? ''}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, about: event.target.value }))
                  }
                  onMouseDown={focusOnPointerDown}
                  rows={4}
                  className="mt-2 w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-sm text-white"
                />
              </label>

              <label className="text-sm text-white md:col-span-2">
                Message For Fans
                <textarea
                  value={form.message_for_fans ?? ''}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, message_for_fans: event.target.value }))
                  }
                  onMouseDown={focusOnPointerDown}
                  rows={3}
                  className="mt-2 w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-sm text-white"
                />
              </label>

              <fieldset className="rounded-xl border border-white/10 p-3 md:col-span-2">
                <legend className="px-2 text-sm text-white">Socials</legend>
                <div className="space-y-2">
                  {form.socials.map((social, index) => (
                    <div key={`social-${index}`} className="grid gap-2 md:grid-cols-[1fr_2fr_auto]">
                      <input
                        value={social.platform}
                        onChange={(event) => updateSocial(index, 'platform', event.target.value)}
                        onMouseDown={focusOnPointerDown}
                        placeholder="Platform"
                        className="rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-sm text-white"
                      />
                      <input
                        value={social.value}
                        onChange={(event) => updateSocial(index, 'value', event.target.value)}
                        onMouseDown={focusOnPointerDown}
                        placeholder="URL / Handle"
                        className="rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-sm text-white"
                      />
                      <button
                        type="button"
                        onClick={() => removeSocial(index)}
                        className="rounded-xl border border-white/20 px-3 py-2 text-xs uppercase tracking-[0.2em] text-white"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={addSocial}
                  className="mt-3 rounded-xl border border-white/20 px-3 py-2 text-xs uppercase tracking-[0.2em] text-white"
                >
                  Add Social
                </button>
              </fieldset>

              <fieldset className="rounded-xl border border-white/10 p-3 md:col-span-2">
                <legend className="px-2 text-sm text-white">Profile Photo</legend>
                <div className="mt-2 flex flex-wrap items-start gap-4">
                  <div className="h-24 w-24 overflow-hidden rounded-lg border border-white/15 bg-black/20">
                    {(previewUrl || resolvedProfilePreviewUrl) ? (
                      <img
                        src={previewUrl || resolvedProfilePreviewUrl || ''}
                        alt="Profile preview"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[10px] uppercase tracking-[0.12em] text-slate-400">
                        No photo
                      </div>
                    )}
                  </div>

                  <div className="min-w-[240px] flex-1 space-y-2">
                    <input
                      value={form.profilePhotoUrl}
                      onChange={(event) =>
                        setForm((prev) => ({ ...prev, profilePhotoUrl: event.target.value }))
                      }
                      disabled={!caps.canEditProfilePhoto || saving}
                      placeholder="Profile photo URL"
                      className="w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-sm text-white disabled:bg-black/30 disabled:text-slate-300"
                    />
                    {caps.canUploadProfilePhoto && (
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(event) => {
                          const file = event.target.files?.[0] || null;
                          setProfilePhotoFile(file);
                        }}
                        disabled={!caps.canEditProfilePhoto || saving}
                        className="block w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-sm text-white disabled:bg-black/30 disabled:text-slate-300"
                      />
                    )}
                    {!caps.canEditProfilePhoto && (
                      <p className="text-xs text-slate-400">Profile photo is not editable on this deployment.</p>
                    )}
                  </div>
                </div>
              </fieldset>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm text-white disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-white/20 px-4 py-2 text-sm text-white"
              >
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
