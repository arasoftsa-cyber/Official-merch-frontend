import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ErrorState from '../components/ux/ErrorState';
import { API_BASE, apiFetch } from '../shared/api/http';
import { getAccessToken } from '../shared/auth/tokenStore';
import { Container, Page } from '../ui/Page';
import { useLocalStorageState } from '../utils/useLocalStorageState';

type SocialDraft = {
  platform: string;
  url: string;
};

type ProfilePhotoDraft = {
  mediaAssetId?: string;
  publicUrl?: string;
  name?: string;
  size?: number;
  type?: string;
} | null;

type ApplyArtistDraft = {
  artistName: string;
  handle: string;
  email: string;
  phone: string;
  socials: SocialDraft[];
  aboutMe: string;
  messageForFans: string;
  profilePhoto: ProfilePhotoDraft;
};

const DRAFT_KEY = 'apply_artist_draft';
const defaultDraft: ApplyArtistDraft = {
  artistName: '',
  handle: '',
  email: '',
  phone: '',
  socials: [],
  aboutMe: '',
  messageForFans: '',
  profilePhoto: null,
};

const hydrateDraftFromSession = (): ApplyArtistDraft | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return {
      artistName: typeof parsed?.artistName === 'string' ? parsed.artistName : '',
      handle: typeof parsed?.handle === 'string' ? parsed.handle : '',
      email: typeof parsed?.email === 'string' ? parsed.email : '',
      phone: typeof parsed?.phone === 'string' ? parsed.phone : '',
      socials: Array.isArray(parsed?.socials)
        ? parsed.socials.map((row: any) => ({
            platform: typeof row?.platform === 'string' ? row.platform : '',
            url: typeof row?.url === 'string' ? row.url : '',
          }))
        : [],
      aboutMe: typeof parsed?.aboutMe === 'string' ? parsed.aboutMe : '',
      messageForFans: typeof parsed?.messageForFans === 'string' ? parsed.messageForFans : '',
      profilePhoto: parsed?.profilePhoto
        ? {
            name: typeof parsed.profilePhoto?.name === 'string' ? parsed.profilePhoto.name : '',
            size:
              typeof parsed.profilePhoto?.size === 'number' &&
              Number.isFinite(parsed.profilePhoto.size)
                ? parsed.profilePhoto.size
                : 0,
            type: typeof parsed.profilePhoto?.type === 'string' ? parsed.profilePhoto.type : '',
          }
        : null,
    };
  } catch {
    return null;
  }
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const SOCIAL_PLATFORMS = ['YT', 'insta', 'fb', 'thread', 'twitter', 'discord'];

type UniqueField = 'handle' | 'email' | 'phone';

function getTakenMessage(field: UniqueField) {
  if (field === 'handle') return 'That handle is already taken.';
  if (field === 'email') return 'That email is already in use.';
  return 'That phone number is already in use.';
}

function isFieldTaken(payload: any) {
  if (typeof payload?.available === 'boolean') return !payload.available;
  if (typeof payload?.isAvailable === 'boolean') return !payload.isAvailable;
  if (typeof payload?.exists === 'boolean') return payload.exists;
  if (typeof payload?.taken === 'boolean') return payload.taken;
  if (typeof payload?.isTaken === 'boolean') return payload.isTaken;
  return false;
}

export default function ApplyArtistPage() {
  const navigate = useNavigate();
  const loggedIn = Boolean(getAccessToken());
  const { state: draft, setStateAndPersist, clearPersisted } = useLocalStorageState<ApplyArtistDraft>(
    DRAFT_KEY,
    defaultDraft,
    200
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success'>('idle');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [checking, setChecking] = useState<Record<UniqueField, boolean>>({
    handle: false,
    email: false,
    phone: false,
  });
  const uniqueSeqRef = useRef<Record<UniqueField, number>>({
    handle: 0,
    email: 0,
    phone: 0,
  });
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoUploadError, setPhotoUploadError] = useState<string | null>(null);
  const [authChangedSinceDraft, setAuthChangedSinceDraft] = useState(false);

  useEffect(() => {
    const restored = hydrateDraftFromSession();
    if (!restored) return;
    setStateAndPersist(restored);
    try {
      const raw = window.sessionStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (typeof parsed?.authLoggedIn === 'boolean' && parsed.authLoggedIn !== loggedIn) {
        setAuthChangedSinceDraft(true);
      }
    } catch {
      // ignore parse issues
    }
  }, [loggedIn, setStateAndPersist]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.sessionStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({
          artistName: draft.artistName,
          handle: draft.handle,
          email: draft.email,
          phone: draft.phone,
          socials: draft.socials,
          aboutMe: draft.aboutMe,
          messageForFans: draft.messageForFans,
          profilePhoto: draft.profilePhoto
            ? {
                name: draft.profilePhoto.name ?? '',
                size: draft.profilePhoto.size ?? 0,
                type: draft.profilePhoto.type ?? '',
              }
            : null,
          authLoggedIn: loggedIn,
        })
      );
    } catch {
      // ignore storage write failures
    }
  }, [draft, loggedIn]);

  const canSubmit = useMemo(
    () =>
      Boolean(
        draft.artistName.trim() &&
          draft.handle.trim() &&
          draft.email.trim() &&
          draft.phone.trim()
      ),
    [draft.artistName, draft.email, draft.handle, draft.phone]
  );

  const handleFieldChange =
    (field: keyof Omit<ApplyArtistDraft, 'socials' | 'profilePhoto'>) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const value = event.target.value;
      setStateAndPersist({ [field]: value } as Partial<ApplyArtistDraft>);
      setErrors((prev) => {
        if (!prev[field]) return prev;
        const next = { ...prev };
        delete next[field];
        return next;
      });
    };

  const handleSocialChange =
    (index: number, field: keyof SocialDraft) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const value = event.target.value;
      setStateAndPersist((prev) => {
        const socials = [...prev.socials];
        socials[index] = { ...socials[index], [field]: value };
        return { socials };
      });
      setErrors((prev) => {
        const key = `socials.${index}.${field}`;
        if (!prev[key]) return prev;
        const next = { ...prev };
        delete next[key];
        return next;
      });
    };

  const addSocialRow = () => {
    setStateAndPersist((prev) => ({ socials: [...prev.socials, { platform: '', url: '' }] }));
  };

  const removeSocialRow = (index: number) => {
    setStateAndPersist((prev) => ({ socials: prev.socials.filter((_, i) => i !== index) }));
    setErrors((prev) => {
      const next: Record<string, string> = {};
      for (const [key, value] of Object.entries(prev)) {
        if (!key.startsWith('socials.')) {
          next[key] = value;
          continue;
        }
        const match = key.match(/^socials\.(\d+)\.(platform|url)$/);
        if (!match) {
          next[key] = value;
          continue;
        }
        const rowIndex = Number(match[1]);
        const field = match[2];
        if (rowIndex === index) continue;
        if (rowIndex > index) {
          next[`socials.${rowIndex - 1}.${field}`] = value;
          continue;
        }
        next[key] = value;
      }
      return next;
    });
  };

  const validateLocal = useCallback(() => {
    const next: Record<string, string> = {};
    if (!draft.artistName.trim()) next.artistName = 'Artist name is required.';
    if (!draft.handle.trim()) next.handle = 'Handle is required.';
    if (!draft.email.trim()) next.email = 'Email is required.';
    if (!draft.phone.trim()) next.phone = 'Phone is required.';
    if (draft.email.trim() && !EMAIL_RE.test(draft.email.trim())) {
      next.email = 'Enter a valid email address.';
    }

    draft.socials.forEach((row, index) => {
      if (!row.platform.trim()) {
        next[`socials.${index}.platform`] = 'Platform is required.';
      }
      if (!row.url.trim()) {
        next[`socials.${index}.url`] = 'Profile link is required.';
      }
    });

    return next;
  }, [draft.artistName, draft.email, draft.handle, draft.phone, draft.socials]);

  const checkUnique = useCallback(
    async (field: UniqueField, value: string) => {
      const trimmed = value.trim();
      if (!trimmed) return '';
      const nextSeq = uniqueSeqRef.current[field] + 1;
      uniqueSeqRef.current[field] = nextSeq;
      setChecking((prev) => ({ ...prev, [field]: true }));
      try {
        const payload = await apiFetch(
          `/api/artist-access-requests/check?${field}=${encodeURIComponent(trimmed)}`
        );
        if (uniqueSeqRef.current[field] !== nextSeq) return '';
        if (isFieldTaken(payload)) {
          return payload?.message || getTakenMessage(field);
        }
        return '';
      } catch (err: any) {
        if (uniqueSeqRef.current[field] !== nextSeq) return '';
        if (err?.status === 409) return err?.message || getTakenMessage(field);
        if (err?.status === 400) return err?.message || `Invalid ${field}.`;
        return `Unable to verify ${field} right now.`;
      } finally {
        if (uniqueSeqRef.current[field] === nextSeq) {
          setChecking((prev) => ({ ...prev, [field]: false }));
        }
      }
    },
    []
  );

  const handleUniqueBlur =
    (field: UniqueField) => async (event: React.FocusEvent<HTMLInputElement>) => {
      const message = await checkUnique(field, event.target.value);
      setErrors((prev) => {
        const next = { ...prev };
        if (message) next[field] = message;
        else delete next[field];
        return next;
      });
    };

  const handleProfilePhotoChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      setPhotoUploadError(null);
      setPhotoUploading(true);

      const uploadWithField = async (fieldName: string) => {
        const fd = new FormData();
        fd.append(fieldName, file);
        return apiFetch('/api/media-assets', {
          method: 'POST',
          body: fd,
        });
      };

      try {
        let payload: any;
        try {
          payload = await uploadWithField('file');
        } catch {
          payload = await uploadWithField('profilePhoto');
        }

        const mediaAssetId = String(payload?.id ?? payload?.mediaAssetId ?? payload?.item?.id ?? '');
        const publicUrl = String(
          payload?.publicUrl ??
            payload?.public_url ??
            payload?.url ??
            payload?.item?.publicUrl ??
            payload?.item?.public_url ??
            ''
        );
        if (!mediaAssetId || !publicUrl) {
          throw new Error('Upload response missing media asset fields.');
        }

        setStateAndPersist({
          profilePhoto: {
            name: file.name,
            size: file.size,
            type: file.type,
            mediaAssetId,
            publicUrl,
          },
        });
      } catch {
        setPhotoUploadError('Unable to upload profile photo right now.');
      } finally {
        setPhotoUploading(false);
      }
    },
    [setStateAndPersist]
  );

  const removeProfilePhoto = useCallback(() => {
    setPhotoUploadError(null);
    setStateAndPersist({ profilePhoto: null });
    if (photoInputRef.current) {
      photoInputRef.current.value = '';
    }
  }, [setStateAndPersist]);

  const handleSubmit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (status === 'submitting' || photoUploading) return;
      if (!loggedIn) {
        navigate('/login?returnTo=%2Fapply%2Fartist');
        return;
      }

      const nextErrors = validateLocal();
      setSubmitError(null);
      if (Object.keys(nextErrors).length) {
        setErrors(nextErrors);
        return;
      }

      const [handleErr, emailErr, phoneErr] = await Promise.all([
        checkUnique('handle', draft.handle),
        checkUnique('email', draft.email),
        checkUnique('phone', draft.phone),
      ]);
      if (handleErr || emailErr || phoneErr) {
        setErrors((prev) => ({
          ...prev,
          ...(handleErr ? { handle: handleErr } : {}),
          ...(emailErr ? { email: emailErr } : {}),
          ...(phoneErr ? { phone: phoneErr } : {}),
        }));
        return;
      }

      setErrors({});
      setStatus('submitting');
      try {
        const artistName = draft.artistName.trim();
        const handle = draft.handle.trim();
        const email = draft.email.trim();
        const phone = draft.phone.trim();
        const aboutMe = draft.aboutMe.trim();
        const messageForFans = draft.messageForFans.trim();
        const socialsArray = draft.socials.map((row) => ({
          platform: row.platform.trim(),
          profileLink: row.url.trim(),
        }));

        const fd = new FormData();
        fd.append('artistName', artistName);
        fd.append('handle', handle);
        fd.append('email', email);
        fd.append('phone', phone);
        fd.append('aboutMe', aboutMe || '');
        fd.append('messageForFans', messageForFans || '');
        fd.append('socials', JSON.stringify(socialsArray));
        if (draft.profilePhoto?.mediaAssetId) {
          fd.append('profilePhotoMediaAssetId', draft.profilePhoto.mediaAssetId);
        }
        if (draft.profilePhoto?.publicUrl) {
          fd.append('profilePhotoPublicUrl', draft.profilePhoto.publicUrl);
        }

        const token = getAccessToken();
        const response = await fetch(`${API_BASE}/api/artist-access-requests`, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: fd,
        });

        if (response.status === 201) {
          clearPersisted();
          if (typeof window !== 'undefined') {
            window.sessionStorage.removeItem(DRAFT_KEY);
          }
          setStatus('success');
          return;
        }

        let payload: any = null;
        const contentType = response.headers.get('content-type') ?? '';
        if (contentType.includes('application/json')) {
          payload = await response.json().catch(() => null);
        }

        if (response.status === 400) {
          const field = String(payload?.field ?? '').trim();
          const byField: Record<string, string> = {
            artistName: 'Artist name is required.',
            handle: 'Handle is required.',
            email: 'Please enter a valid email.',
            phone: 'Phone is required.',
            socials: 'Please complete each socials row.',
          };
          setSubmitError(
            byField[field] || payload?.message || 'Validation failed. Please review the form.'
          );
        } else if (response.status === 409) {
          setSubmitError('email/phone/handle already exists');
        } else {
          setSubmitError(payload?.message || 'Unable to submit your request.');
        }
        setStatus('idle');
      } catch {
        setSubmitError('Unable to submit your request.');
        setStatus('idle');
      }
    },
    [checkUnique, clearPersisted, draft, loggedIn, navigate, photoUploading, status, validateLocal]
  );

  if (status === 'success') {
    return (
      <Page>
        <Container className="space-y-4">
          <h1 className="text-3xl font-semibold text-white">Request Sent</h1>
          <p className="text-white/70">Admin will review and contact you.</p>
          <Link to="/" className="text-sm text-emerald-300 underline">
            Back to home
          </Link>
        </Container>
      </Page>
    );
  }

  return (
    <Page>
      <Container className="space-y-4">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Apply</p>
          <h1 className="text-3xl font-semibold text-white">Artist Request</h1>
        </div>
        {authChangedSinceDraft && (
          <p className="rounded-xl border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
            Please reselect photo after login
          </p>
        )}
        {submitError && <ErrorState message={submitError} />}
        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="block text-sm font-medium text-white/80">
            Artist Name *
            <input
              type="text"
              value={draft.artistName}
              onChange={handleFieldChange('artistName')}
              className="mt-2 block w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white focus:border-white/40 focus:outline-none"
              placeholder="e.g. Nova Maker"
              aria-invalid={Boolean(errors.artistName)}
            />
            {errors.artistName && <p className="text-xs text-rose-300">{errors.artistName}</p>}
          </label>

          <label className="block text-sm font-medium text-white/80">
            Handle *
            <input
              type="text"
              value={draft.handle}
              onChange={handleFieldChange('handle')}
              onBlur={handleUniqueBlur('handle')}
              className="mt-2 block w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white focus:border-white/40 focus:outline-none"
              placeholder="@yourhandle"
              aria-invalid={Boolean(errors.handle)}
            />
            {checking.handle && <p className="text-xs text-white/60">Checking handle...</p>}
            {errors.handle && <p className="text-xs text-rose-300">{errors.handle}</p>}
          </label>

          <label className="block text-sm font-medium text-white/80">
            Email *
            <input
              type="email"
              value={draft.email}
              onChange={handleFieldChange('email')}
              onBlur={handleUniqueBlur('email')}
              className="mt-2 block w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white focus:border-white/40 focus:outline-none"
              placeholder="you@example.com"
              aria-invalid={Boolean(errors.email)}
            />
            {checking.email && <p className="text-xs text-white/60">Checking email...</p>}
            {errors.email && <p className="text-xs text-rose-300">{errors.email}</p>}
          </label>

          <label className="block text-sm font-medium text-white/80">
            Phone *
            <input
              type="tel"
              value={draft.phone}
              onChange={handleFieldChange('phone')}
              onBlur={handleUniqueBlur('phone')}
              className="mt-2 block w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white focus:border-white/40 focus:outline-none"
              placeholder="(555) 555-5555"
              aria-invalid={Boolean(errors.phone)}
            />
            {checking.phone && <p className="text-xs text-white/60">Checking phone...</p>}
            {errors.phone && <p className="text-xs text-rose-300">{errors.phone}</p>}
          </label>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-white/80">Socials</p>
              <button
                type="button"
                onClick={addSocialRow}
                className="rounded-full border border-white/20 px-3 py-1 text-xs font-semibold text-white hover:bg-white/10"
              >
                Add row
              </button>
            </div>

            {draft.socials.map((row, index) => (
              <div key={`social-row-${index}`} className="space-y-2 rounded-xl border border-white/10 p-3">
                <div className="grid gap-3 md:grid-cols-[1fr_2fr_auto] md:items-start">
                  <label className="block text-sm font-medium text-white/80">
                    Platform
                    <select
                      value={row.platform}
                      onChange={handleSocialChange(index, 'platform')}
                      className="mt-2 block w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white focus:border-white/40 focus:outline-none"
                      aria-invalid={Boolean(errors[`socials.${index}.platform`])}
                    >
                      <option value="">Select</option>
                      {SOCIAL_PLATFORMS.map((platform) => (
                        <option key={platform} value={platform}>
                          {platform}
                        </option>
                      ))}
                    </select>
                    {errors[`socials.${index}.platform`] && (
                      <p className="text-xs text-rose-300">{errors[`socials.${index}.platform`]}</p>
                    )}
                  </label>

                  <label className="block text-sm font-medium text-white/80">
                    Profile Link
                    <input
                      type="text"
                      value={row.url}
                      onChange={handleSocialChange(index, 'url')}
                      className="mt-2 block w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white focus:border-white/40 focus:outline-none"
                      placeholder="https://..."
                      aria-invalid={Boolean(errors[`socials.${index}.url`])}
                    />
                    {errors[`socials.${index}.url`] && (
                      <p className="text-xs text-rose-300">{errors[`socials.${index}.url`]}</p>
                    )}
                  </label>

                  <button
                    type="button"
                    onClick={() => removeSocialRow(index)}
                    className="mt-7 rounded-full border border-white/20 px-3 py-2 text-xs font-semibold text-white hover:bg-white/10"
                    aria-label={`Remove social row ${index + 1}`}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>

          <label className="block text-sm font-medium text-white/80">
            About Me
            <textarea
              value={draft.aboutMe}
              onChange={handleFieldChange('aboutMe')}
              rows={4}
              className="mt-2 block w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white focus:border-white/40 focus:outline-none"
              placeholder="Tell us about your music and audience."
            />
          </label>

          <label className="block text-sm font-medium text-white/80">
            Profile Photo
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              onChange={handleProfilePhotoChange}
              className="mt-2 block w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white file:mr-3 file:rounded-full file:border-0 file:bg-white file:px-3 file:py-1 file:text-xs file:font-semibold file:text-black"
            />
            {photoUploading && <p className="mt-2 text-xs text-white/60">Uploading photo...</p>}
            {photoUploadError && <p className="mt-2 text-xs text-rose-300">{photoUploadError}</p>}
            {draft.profilePhoto?.publicUrl && (
              <div className="mt-3 space-y-2">
                <img
                  src={draft.profilePhoto.publicUrl}
                  alt="Profile preview"
                  className="h-24 w-24 rounded-xl border border-white/20 object-cover"
                />
                <div className="flex items-center gap-3">
                  <a
                    href={draft.profilePhoto.publicUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-emerald-300 underline"
                  >
                    Open uploaded photo
                  </a>
                  <button
                    type="button"
                    onClick={removeProfilePhoto}
                    className="rounded-full border border-white/20 px-3 py-1 text-xs font-semibold text-white hover:bg-white/10"
                  >
                    Remove photo
                  </button>
                </div>
              </div>
            )}
            {draft.profilePhoto && !draft.profilePhoto.publicUrl && (
              <p className="mt-2 text-xs text-white/60">
                Selected: {draft.profilePhoto.name || 'photo'} ({draft.profilePhoto.type || 'file'})
              </p>
            )}
          </label>

          <label className="block text-sm font-medium text-white/80">
            Message For Fans
            <textarea
              value={draft.messageForFans}
              onChange={handleFieldChange('messageForFans')}
              rows={4}
              className="mt-2 block w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white focus:border-white/40 focus:outline-none"
              placeholder="What should your fans know?"
            />
          </label>

          {!loggedIn ? (
            <button
              type="button"
              onClick={() => navigate('/login?returnTo=%2Fapply%2Fartist')}
              className="w-full rounded-full bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-white/90"
            >
              Login to submit
            </button>
          ) : (
            <button
              type="submit"
              disabled={!canSubmit || status === 'submitting' || photoUploading}
              className="w-full rounded-full bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-white/90 disabled:opacity-50"
              aria-busy={status === 'submitting' || photoUploading}
            >
              {photoUploading
                ? 'Uploading photo...'
                : status === 'submitting'
                ? 'Submitting...'
                : 'Request Onboarding'}
            </button>
          )}
        </form>
      </Container>
    </Page>
  );
}
