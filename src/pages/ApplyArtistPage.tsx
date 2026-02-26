import React, { useEffect, useMemo, useState } from 'react';
import ErrorState from '../components/ux/ErrorState';
import { API_BASE } from '../shared/api/http';
import { Container, Page } from '../ui/Page';

type SocialRow = {
  platform: string;
  url: string;
};

type FormState = {
  artistName: string;
  handle: string;
  email: string;
  phone: string;
  socials: SocialRow[];
  aboutMe: string;
  messageForFans: string;
  profilePhoto: File | null;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const HTTP_RE = /^https?:\/\//i;
const MAX_SOCIAL_ROWS = 5;
const SOCIAL_PLATFORMS = ['instagram', 'youtube', 'spotify', 'facebook', 'x', 'website', 'other'];

const INITIAL_FORM: FormState = {
  artistName: '',
  handle: '',
  email: '',
  phone: '',
  socials: [],
  aboutMe: '',
  messageForFans: '',
  profilePhoto: null,
};

type ValidationErrors = Record<string, string>;

const normalizeHandle = (value: string) => value.trim().replace(/^@+/, '').toLowerCase();
const buildSocialsArray = (rows: SocialRow[]) =>
  (Array.isArray(rows) ? rows : [])
    .map((row) => ({
      platform: String(row?.platform ?? '').trim(),
      url: String(row?.url ?? '').trim(),
    }))
    .filter((row) => row.platform && row.url)
    .slice(0, MAX_SOCIAL_ROWS);

const buildConflictMessage = (field: string) => {
  if (field === 'email') return 'That email is already in use.';
  if (field === 'phone') return 'That phone number is already in use.';
  if (field === 'handle') return 'That handle is already in use.';
  return 'A conflicting request already exists.';
};

const mapValidationDetails = (details: any[]): ValidationErrors => {
  const next: ValidationErrors = {};
  for (const detail of details || []) {
    const field = String(detail?.field || '').trim();
    const message = String(detail?.message || 'Invalid value').trim();
    if (!field) continue;
    if (field === 'artist_name') next.artistName = message;
    else if (field === 'handle') next.handle = message;
    else if (field === 'email') next.email = message;
    else if (field === 'phone') next.phone = message;
    else if (field === 'about') next.aboutMe = message;
    else if (field === 'message_for_fans') next.messageForFans = message;
    else if (field.startsWith('socials[')) {
      const idx = field.match(/^socials\[(\d+)\]/)?.[1];
      if (idx != null) next[`socials.${idx}`] = message;
    }
  }
  return next;
};

export default function ApplyArtistPage() {
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    document.title = 'Artist Request';
  }, []);

  const canAddSocial = form.socials.length < MAX_SOCIAL_ROWS;

  const clientValidation = useMemo(() => {
    const next: ValidationErrors = {};
    if (!form.artistName.trim()) next.artistName = 'Artist Name is required.';
    if (!form.handle.trim()) next.handle = 'Handle is required.';
    if (!form.email.trim()) next.email = 'Email is required.';
    if (!form.phone.trim()) next.phone = 'Phone is required.';
    if (form.handle.trim() && normalizeHandle(form.handle).length < 2) {
      next.handle = 'Handle must be at least 2 characters.';
    }
    if (form.email.trim() && !EMAIL_RE.test(form.email.trim())) {
      next.email = 'Enter a valid email address.';
    }
    form.socials.forEach((row, index) => {
      if (!row.platform.trim() || !row.url.trim()) {
        next[`socials.${index}`] = 'Platform and URL are required.';
        return;
      }
      if (!HTTP_RE.test(row.url.trim())) {
        next[`socials.${index}`] = 'URL must start with http or https.';
      }
    });
    return next;
  }, [form]);

  const onFieldChange =
    (field: keyof Omit<FormState, 'socials' | 'profilePhoto'>) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const value = event.target.value;
      setForm((prev) => ({ ...prev, [field]: value }));
      setErrors((prev) => {
        if (!prev[field]) return prev;
        const next = { ...prev };
        delete next[field];
        return next;
      });
      setSuccess(false);
      setSubmitError(null);
    };

  const onSocialChange =
    (index: number, field: keyof SocialRow) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const value = event.target.value;
      setForm((prev) => {
        const socials = [...prev.socials];
        socials[index] = { ...socials[index], [field]: value };
        return { ...prev, socials };
      });
      setErrors((prev) => {
        const key = `socials.${index}`;
        if (!prev[key]) return prev;
        const next = { ...prev };
        delete next[key];
        return next;
      });
      setSuccess(false);
      setSubmitError(null);
    };

  const addSocialRow = () => {
    if (!canAddSocial) return;
    setForm((prev) => ({ ...prev, socials: [...prev.socials, { platform: '', url: '' }] }));
    setSuccess(false);
    setSubmitError(null);
  };

  const removeSocialRow = (index: number) => {
    setForm((prev) => ({ ...prev, socials: prev.socials.filter((_, i) => i !== index) }));
    setErrors((prev) => {
      const next: ValidationErrors = {};
      Object.entries(prev).forEach(([key, value]) => {
        if (!key.startsWith('socials.')) {
          next[key] = value;
          return;
        }
        const row = Number(key.split('.')[1]);
        if (Number.isNaN(row) || row === index) return;
        const shifted = row > index ? row - 1 : row;
        next[`socials.${shifted}`] = value;
      });
      return next;
    });
    setSuccess(false);
    setSubmitError(null);
  };

  const onPhotoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    setForm((prev) => ({ ...prev, profilePhoto: file }));
    setSuccess(false);
    setSubmitError(null);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting) return;

    const nextErrors = clientValidation;
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setErrors({});
    setSubmitError(null);
    setSuccess(false);
    setSubmitting(true);

    const handle = normalizeHandle(form.handle);
    const socialsArray = buildSocialsArray(form.socials);

    let response: Response;
    const isMultipart = Boolean(form.profilePhoto);
    try {
      if (isMultipart) {
        const fd = new FormData();
        fd.append('artist_name', form.artistName.trim());
        fd.append('handle', handle);
        fd.append('email', form.email.trim().toLowerCase());
        fd.append('phone', form.phone.trim());
        fd.append('about_me', form.aboutMe.trim());
        fd.append('message_for_fans', form.messageForFans.trim());
        fd.append('profile_photo', form.profilePhoto as File);
        fd.append('socials', JSON.stringify(socialsArray));
        response = await fetch(`${API_BASE}/api/artist-access-requests`, {
          method: 'POST',
          body: fd,
        });
      } else {
        response = await fetch(`${API_BASE}/api/artist-access-requests`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            artist_name: form.artistName.trim(),
            handle,
            email: form.email.trim().toLowerCase(),
            phone: form.phone.trim(),
            about_me: form.aboutMe.trim(),
            message_for_fans: form.messageForFans.trim(),
            socials: socialsArray,
          }),
        });
      }
    } catch {
      setSubmitError('Unable to submit request');
      setSubmitting(false);
      return;
    }

    if (!response.ok) {
      let data: any = null;
      try {
        data = await response.json();
      } catch {
        data = null;
      }

      if (data?.error === 'validation') {
        const details = Array.isArray(data?.details) ? data.details : [];
        const fieldErrors = mapValidationDetails(details);
        if (Object.keys(fieldErrors).length > 0) {
          setErrors(fieldErrors);
        }
        setSubmitError(String(details[0]?.message || 'Unable to submit request'));
      } else if (data?.error === 'conflict') {
        const field = String(data?.field || 'field').trim();
        const message = `${field} already used`;
        setSubmitError(message);
        if (field === 'email' || field === 'phone' || field === 'handle') {
          setErrors((prev) => ({ ...prev, [field]: message }));
        }
      } else {
        setSubmitError('Unable to submit request');
      }
      setSubmitting(false);
      return;
    }

    setForm(INITIAL_FORM);
    setErrors({});
    setSubmitError(null);
    setSuccess(true);
    setSubmitting(false);
  };

  return (
    <Page>
      <Container className="space-y-4">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Apply</p>
          <h1 className="text-3xl font-semibold text-white">Artist Request</h1>
        </div>
        {submitError && <ErrorState message={submitError} />}
        {success && (
          <p className="rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
            Request submitted. We&apos;ll reach out soon.
          </p>
        )}

        <form className="space-y-4" onSubmit={submit}>
          <label className="block text-sm font-medium text-white/80">
            Artist Name *
            <input
              type="text"
              value={form.artistName}
              onChange={onFieldChange('artistName')}
              className="mt-2 block w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white focus:border-white/40 focus:outline-none"
              aria-invalid={Boolean(errors.artistName)}
            />
            {errors.artistName && <p className="text-xs text-rose-300">{errors.artistName}</p>}
          </label>

          <label className="block text-sm font-medium text-white/80">
            Handle *
            <input
              type="text"
              value={form.handle}
              onChange={onFieldChange('handle')}
              placeholder="@yourhandle"
              className="mt-2 block w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white focus:border-white/40 focus:outline-none"
              aria-invalid={Boolean(errors.handle)}
            />
            {errors.handle && <p className="text-xs text-rose-300">{errors.handle}</p>}
          </label>

          <label className="block text-sm font-medium text-white/80">
            Email *
            <input
              type="email"
              value={form.email}
              onChange={onFieldChange('email')}
              className="mt-2 block w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white focus:border-white/40 focus:outline-none"
              aria-invalid={Boolean(errors.email)}
            />
            {errors.email && <p className="text-xs text-rose-300">{errors.email}</p>}
          </label>

          <label className="block text-sm font-medium text-white/80">
            Phone *
            <input
              type="text"
              value={form.phone}
              onChange={onFieldChange('phone')}
              className="mt-2 block w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white focus:border-white/40 focus:outline-none"
              aria-invalid={Boolean(errors.phone)}
            />
            {errors.phone && <p className="text-xs text-rose-300">{errors.phone}</p>}
          </label>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-white/80">Socials</p>
              <button
                type="button"
                onClick={addSocialRow}
                disabled={!canAddSocial}
                className="rounded-full border border-white/20 px-3 py-1 text-xs font-semibold text-white hover:bg-white/10 disabled:opacity-50"
              >
                Add row
              </button>
            </div>

            {form.socials.map((row, index) => (
              <div key={`social-row-${index}`} className="space-y-2 rounded-xl border border-white/10 p-3">
                <div className="grid gap-3 md:grid-cols-[1fr_2fr_auto] md:items-start">
                  <label className="block text-sm font-medium text-white/80">
                    Platform
                    <select
                      value={row.platform}
                      onChange={onSocialChange(index, 'platform')}
                      className="mt-2 block w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white focus:border-white/40 focus:outline-none"
                    >
                      <option value="">Select</option>
                      {SOCIAL_PLATFORMS.map((platform) => (
                        <option key={platform} value={platform}>
                          {platform}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block text-sm font-medium text-white/80">
                    URL
                    <input
                      type="text"
                      value={row.url}
                      onChange={onSocialChange(index, 'url')}
                      placeholder="https://..."
                      className="mt-2 block w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white focus:border-white/40 focus:outline-none"
                    />
                  </label>

                  <button
                    type="button"
                    onClick={() => removeSocialRow(index)}
                    className="mt-7 rounded-full border border-white/20 px-3 py-2 text-xs font-semibold text-white hover:bg-white/10"
                  >
                    Remove
                  </button>
                </div>
                {errors[`socials.${index}`] && (
                  <p className="text-xs text-rose-300">{errors[`socials.${index}`]}</p>
                )}
              </div>
            ))}
          </div>

          <label className="block text-sm font-medium text-white/80">
            About Me
            <textarea
              value={form.aboutMe}
              onChange={onFieldChange('aboutMe')}
              rows={4}
              className="mt-2 block w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white focus:border-white/40 focus:outline-none"
            />
            {errors.aboutMe && <p className="text-xs text-rose-300">{errors.aboutMe}</p>}
          </label>

          <label className="block text-sm font-medium text-white/80">
            Profile Photo
            <input
              type="file"
              accept="image/*"
              onChange={onPhotoChange}
              className="mt-2 block w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white file:mr-3 file:rounded-full file:border-0 file:bg-white file:px-3 file:py-1 file:text-xs file:font-semibold file:text-black"
            />
          </label>

          <label className="block text-sm font-medium text-white/80">
            Message For Fans
            <textarea
              value={form.messageForFans}
              onChange={onFieldChange('messageForFans')}
              rows={4}
              className="mt-2 block w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white focus:border-white/40 focus:outline-none"
            />
            {errors.messageForFans && <p className="text-xs text-rose-300">{errors.messageForFans}</p>}
          </label>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-full bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-white/90 disabled:opacity-50"
          >
            {submitting ? 'Submitting...' : 'Request Onboarding'}
          </button>
        </form>
      </Container>
    </Page>
  );
}
