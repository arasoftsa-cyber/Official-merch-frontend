import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  requestedPlanType: string;
  socials: SocialRow[];
  aboutMe: string;
  messageForFans: string;
  profilePhoto: File | null;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const INDIAN_MOBILE_RE = /^[6-9]\d{9}$/;
const HTTP_RE = /^https?:\/\//i;
const MAX_SOCIAL_ROWS = 5;
const SOCIAL_PLATFORMS = ['instagram', 'youtube', 'spotify', 'facebook', 'x', 'website', 'other'];
const PLAN_OPTIONS = [
  { value: 'basic', label: 'Basic' },
  { value: 'advanced', label: 'Advanced' },
  { value: 'premium', label: 'Premium (Coming soon)', disabled: true },
];

const INITIAL_FORM: FormState = {
  artistName: '',
  handle: '',
  email: '',
  phone: '',
  requestedPlanType: 'basic',
  socials: [],
  aboutMe: '',
  messageForFans: '',
  profilePhoto: null,
};

type ValidationErrors = Record<string, string>;

const normalizeHandle = (value: string) => value.trim().replace(/^@+/, '').toLowerCase();
const normalizePhone = (value: string) => value.trim();
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
    else if (field === 'requested_plan_type' || field === 'planType') next.requestedPlanType = message;
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
  const profilePhotoInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    document.title = 'Artist Request';
  }, []);

  const canAddSocial = form.socials.length < MAX_SOCIAL_ROWS;

  const clientValidation = useMemo(() => {
    const next: ValidationErrors = {};
    const normalizedPhone = normalizePhone(form.phone);
    if (!form.artistName.trim()) next.artistName = 'Artist Name is required.';
    if (!form.handle.trim()) next.handle = 'Handle is required.';
    if (!form.email.trim()) next.email = 'Email is required.';
    if (!normalizedPhone) next.phone = 'Phone number is required';
    if (!form.requestedPlanType.trim()) next.requestedPlanType = 'Plan Type is required.';
    if (form.handle.trim() && normalizeHandle(form.handle).length < 2) {
      next.handle = 'Handle must be at least 2 characters.';
    }
    if (form.email.trim() && !EMAIL_RE.test(form.email.trim())) {
      next.email = 'Enter a valid email address.';
    }
    if (normalizedPhone && !INDIAN_MOBILE_RE.test(normalizedPhone)) {
      next.phone = 'Enter a valid 10-digit Indian mobile number';
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
      (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
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
    const normalizedPhone = normalizePhone(form.phone);
    const socialsArray = buildSocialsArray(form.socials);

    let response: Response;
    const isMultipart = Boolean(form.profilePhoto);
    try {
      if (isMultipart) {
        const fd = new FormData();
        fd.append('artist_name', form.artistName.trim());
        fd.append('handle', handle);
        fd.append('email', form.email.trim().toLowerCase());
        fd.append('phone', normalizedPhone);
        fd.append('requested_plan_type', form.requestedPlanType);
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
            phone: normalizedPhone,
            requested_plan_type: form.requestedPlanType,
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
      let responseBodyText = '';
      if (import.meta.env.DEV) {
        responseBodyText = await response
          .clone()
          .text()
          .catch(() => '');
      }
      let data: any = null;
      try {
        data = await response.json();
      } catch {
        data = null;
      }
      if (import.meta.env.DEV) {
        console.error('[apply/artist] submit failed', {
          status: response.status,
          body: responseBodyText || data,
        });
      }
      const backendMessage =
        typeof data?.error === 'string' && typeof data?.message === 'string'
          ? data.message.trim()
          : '';
      const genericSubmitError = backendMessage
        ? `Unable to submit request: ${backendMessage}`
        : 'Unable to submit request';

      if (data?.error === 'validation') {
        const details = Array.isArray(data?.details) ? data.details : [];
        const fieldErrors = mapValidationDetails(details);
        if (Object.keys(fieldErrors).length > 0) {
          setErrors(fieldErrors);
        }
        setSubmitError(genericSubmitError);
      } else if (data?.error === 'conflict') {
        const field = String(data?.field || 'field').trim();
        const message = `${field} already used`;
        setSubmitError(genericSubmitError);
        if (field === 'email' || field === 'phone' || field === 'handle') {
          setErrors((prev) => ({ ...prev, [field]: message }));
        }
      } else {
        setSubmitError(genericSubmitError);
      }
      setSubmitting(false);
      return;
    }

    setForm(INITIAL_FORM);
    setErrors({});
    setSubmitError(null);
    setSuccess(true);
    if (profilePhotoInputRef.current) {
      profilePhotoInputRef.current.value = '';
    }
    setSubmitting(false);
  };

  return (
    <Page>
      <Container className="space-y-4">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-slate-500 dark:text-slate-400">Apply</p>
          <h1 className="text-3xl font-semibold text-slate-900 dark:text-white">Artist Request</h1>
        </div>
        {submitError && <ErrorState message={submitError} />}
        {success && (
          <p className="rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
            Request submitted. We&apos;ll reach out soon.
          </p>
        )}

        <form className="space-y-4" onSubmit={submit}>
          <label className="block text-sm font-medium text-slate-700 dark:text-white/80">
            Artist Name *
            <input
              type="text"
              value={form.artistName}
              onChange={onFieldChange('artistName')}
              className="mt-2 block w-full rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-black/30 px-3 py-2 text-slate-900 dark:text-white focus:border-indigo-500 dark:focus:border-white/40 focus:outline-none"
              aria-invalid={Boolean(errors.artistName)}
            />
            {errors.artistName && <p className="text-xs text-rose-500 dark:text-rose-300">{errors.artistName}</p>}
          </label>

          <label className="block text-sm font-medium text-slate-700 dark:text-white/80">
            Handle *
            <input
              type="text"
              value={form.handle}
              onChange={onFieldChange('handle')}
              placeholder="@yourhandle"
              className="mt-2 block w-full rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-black/30 px-3 py-2 text-slate-900 dark:text-white focus:border-indigo-500 dark:focus:border-white/40 focus:outline-none"
              aria-invalid={Boolean(errors.handle)}
            />
            {errors.handle && <p className="text-xs text-rose-500 dark:text-rose-300">{errors.handle}</p>}
          </label>

          <label className="block text-sm font-medium text-slate-700 dark:text-white/80">
            Email *
            <input
              type="email"
              value={form.email}
              onChange={onFieldChange('email')}
              className="mt-2 block w-full rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-black/30 px-3 py-2 text-slate-900 dark:text-white focus:border-indigo-500 dark:focus:border-white/40 focus:outline-none"
              aria-invalid={Boolean(errors.email)}
            />
            {errors.email && <p className="text-xs text-rose-500 dark:text-rose-300">{errors.email}</p>}
          </label>

          <label className="block text-sm font-medium text-slate-700 dark:text-white/80">
            Phone *
            <input
              type="text"
              value={form.phone}
              onChange={onFieldChange('phone')}
              inputMode="numeric"
              autoComplete="tel"
              placeholder="9876543210"
              data-testid="apply-artist-phone-input"
              className="mt-2 block w-full rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-black/30 px-3 py-2 text-slate-900 dark:text-white focus:border-indigo-500 dark:focus:border-white/40 focus:outline-none"
              aria-invalid={Boolean(errors.phone)}
              aria-describedby="apply-artist-phone-helper"
            />
            <p
              id="apply-artist-phone-helper"
              className={`mt-1 min-h-[1.25rem] text-xs ${
                errors.phone ? 'text-rose-500 dark:text-rose-300' : 'text-slate-500 dark:text-white/60'
              }`}
            >
              {errors.phone || 'Enter your 10-digit mobile number. Country code +91 is assumed.'}
            </p>
          </label>

          <div className="space-y-3">
            <span className="block text-sm font-medium text-slate-700 dark:text-white/80">Plan Type *</span>
            <div className="grid gap-6 md:grid-cols-3 selection-cards">
              {/* Basic Plan */}
              <button
                type="button"
                onClick={() => {
                  setForm((prev) => ({ ...prev, requestedPlanType: 'basic' }));
                  setErrors((prev) => {
                    if (!prev.requestedPlanType) return prev;
                    const next = { ...prev };
                    delete next.requestedPlanType;
                    return next;
                  });
                }}
                className={`flex flex-col items-center justify-between overflow-hidden rounded-[2rem] p-6 text-center transition-all ${form.requestedPlanType === 'basic'
                  ? 'ring-4 ring-white/50 bg-indigo-200 shadow-xl'
                  : 'bg-indigo-100 hover:bg-indigo-200/80 shadow-md'
                  }`}
                style={{
                  minHeight: '340px',
                  position: 'relative',
                  borderTopRightRadius: form.requestedPlanType === 'basic' ? '2rem' : '4rem',
                }}
              >
                {/* Simulated curled edge aesthetic from image */}
                {form.requestedPlanType !== 'basic' && (
                  <div className="absolute top-[-10px] right-[-10px] w-16 h-16 bg-indigo-300 rounded-bl-full opacity-50 z-[-1]"></div>
                )}
                <div className="w-full relative z-10">
                  <p className="text-sm text-black/60 font-medium tracking-wide">On Demand Artist Plan</p>
                  <p className="mt-1 text-lg font-bold text-gray-800">Basic</p>
                  <h3 className="mt-2 text-4xl font-bold text-gray-900">Free</h3>
                  <div className="mt-6 flex flex-col items-start space-y-2.5 text-[13px] text-gray-700 w-fit mx-auto font-medium">
                    <p className="flex items-center gap-2"><span className="text-white bg-indigo-300 rounded-full p-0.5 text-[10px]">✓</span> 1 Design</p>
                    <p className="flex items-center gap-2"><span className="text-white bg-indigo-300 rounded-full p-0.5 text-[10px]">✓</span> Artist Portal</p>
                    <p className="flex items-center gap-2 opacity-50"><span className="text-gray-400 bg-gray-200 rounded-full p-0.5 text-[10px]">✕</span> No Drops</p>
                    <p className="flex items-center gap-2 opacity-50"><span className="text-gray-400 bg-gray-200 rounded-full p-0.5 text-[10px]">✕</span> No Shelf & Wall Of Fans</p>
                  </div>
                </div>
                <div className="w-full mt-8 relative z-10">
                  <div className="mx-auto w-[60%] rounded-full bg-white py-2 text-sm font-bold text-gray-800 shadow-sm">
                    Enroll
                  </div>
                </div>
              </button>

              {/* Advanced Plan */}
              <button
                type="button"
                onClick={() => {
                  setForm((prev) => ({ ...prev, requestedPlanType: 'advanced' }));
                  setErrors((prev) => {
                    if (!prev.requestedPlanType) return prev;
                    const next = { ...prev };
                    delete next.requestedPlanType;
                    return next;
                  });
                }}
                className={`flex flex-col items-center justify-between overflow-hidden rounded-[2rem] p-6 text-center transition-all relative z-10 transform ${form.requestedPlanType === 'advanced'
                  ? 'ring-4 ring-white shadow-2xl scale-105 bg-indigo-400'
                  : 'bg-indigo-400/90 shadow-lg hover:scale-[1.02]'
                  }`}
                style={{
                  minHeight: '380px',
                  borderBottomRightRadius: form.requestedPlanType === 'advanced' ? '2rem' : '4rem',
                }}
              >
                {/* Simulated shadow/layer aesthetic from image */}
                {form.requestedPlanType !== 'advanced' && (
                  <div className="absolute bottom-[-15px] right-[-15px] w-[110%] h-[110%] bg-indigo-500 rounded-[2rem] opacity-70 z-[-1]"></div>
                )}
                <div className="w-full pt-2">
                  <p className="text-sm text-white/80 font-medium tracking-wide">On Demand Artist Plan</p>
                  <p className="mt-1 text-xl font-bold text-white">Advanced</p>
                  <div className="mt-2 flex flex-col items-center justify-center">
                    <h3 className="text-4xl font-bold text-white flex items-start justify-center">
                      <span className="text-xl mt-1 mr-1 font-semibold opacity-80">₹</span>
                      999
                    </h3>
                    <p className="text-xs text-indigo-100 mt-0.5">/ year</p>
                  </div>
                  <div className="mt-6 flex flex-col items-start space-y-3 text-sm text-white w-fit mx-auto font-medium">
                    <p className="flex items-center gap-2"><span className="text-white flex items-center justify-center p-0.5 font-bold">&#10003;</span> Up to 4 Designs</p>
                    <p className="flex items-center gap-2"><span className="text-white flex items-center justify-center p-0.5 font-bold">&#10003;</span> Artist Portal</p>
                    <p className="flex items-center gap-2"><span className="text-white flex items-center justify-center p-0.5 font-bold">&#10003;</span> Drops</p>
                    <p className="flex items-center gap-2 opacity-60"><span className="text-indigo-200 bg-indigo-500 rounded-full p-0.5 text-[8px] font-bold">✕</span> No Shelf & Wall Of Fans</p>
                  </div>
                </div>
                <div className="w-full mt-auto mb-2 relative z-10">
                  <div className="mx-auto w-[70%] rounded-full bg-white py-2.5 text-sm font-bold text-gray-900 shadow-md">
                    Enroll
                  </div>
                </div>
              </button>

              {/* Premium Plan */}
              <button
                type="button"
                className={`flex flex-col items-center justify-between overflow-hidden rounded-[2rem] p-6 text-center transition-all relative group opacity-50 cursor-not-allowed bg-zinc-700`}
                disabled
                style={{
                  minHeight: '340px',
                  borderBottomRightRadius: '4rem',
                }}
              >
                {/* Simulated shadow layer from image */}
                <div className="absolute bottom-[-10px] right-[-10px] w-[105%] h-[105%] bg-black rounded-[2rem] opacity-60 z-[-1]"></div>

                <div className="w-full">
                  <p className="text-sm text-white/60 font-medium tracking-wide">On Demand Artist Plan</p>
                  <p className="mt-1 text-lg font-bold text-white">Premium</p>
                  <div className="mt-2 flex flex-col items-center justify-center">
                    <h3 className="text-4xl font-bold text-white flex items-start justify-center">
                      <span className="text-lg mt-1 mr-1 font-semibold opacity-60">₹</span>
                      1999
                    </h3>
                    <p className="text-xs text-zinc-400 mt-0.5">/ year</p>
                  </div>

                  <div className="mt-6 flex flex-col items-start space-y-2.5 text-[13px] text-gray-300 w-fit mx-auto font-medium">
                    <p className="flex items-center gap-2"><span className="text-zinc-400 flex items-center justify-center p-0.5">&#10003;</span> Up to 7 Designs</p>
                    <p className="flex items-center gap-2"><span className="text-zinc-400 flex items-center justify-center p-0.5">&#10003;</span> Artist Portal</p>
                    <p className="flex items-center gap-2"><span className="text-zinc-400 flex items-center justify-center p-0.5">&#10003;</span> Drops</p>
                    <p className="flex items-center gap-2"><span className="text-zinc-400 flex items-center justify-center p-0.5">&#10003;</span> Shelf & Wall Of Fans</p>
                  </div>
                </div>
                <div className="w-full mt-8 relative z-10">
                  <div className="mx-auto w-[60%] rounded-full bg-white overflow-hidden relative border border-white/20">
                    <div className="absolute inset-0 bg-white/10 z-0"></div>
                    <p className="py-2 text-sm font-bold text-gray-800 relative z-10">Enroll</p>
                  </div>
                  <p className="mt-2 text-xs text-rose-300 font-medium opacity-80">(Coming soon)</p>
                </div>
              </button>
            </div>
            {errors.requestedPlanType && (
              <p className="text-xs text-rose-300">{errors.requestedPlanType}</p>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-700 dark:text-white/80">Socials</p>
              <button
                type="button"
                onClick={addSocialRow}
                disabled={!canAddSocial}
                className="rounded-full border border-slate-300 dark:border-white/20 px-3 py-1 text-xs font-semibold text-slate-700 dark:text-white hover:bg-slate-100 dark:hover:bg-white/10 disabled:opacity-50"
              >
                Add row
              </button>
            </div>

            {form.socials.map((row, index) => (
              <div key={`social-row-${index}`} className="space-y-2 rounded-xl border border-slate-300 dark:border-white/10 p-3">
                <div className="grid gap-3 md:grid-cols-[1fr_2fr_auto] md:items-start">
                  <label className="block text-sm font-medium text-slate-700 dark:text-white/80">
                    Platform
                    <select
                      value={row.platform}
                      onChange={onSocialChange(index, 'platform')}
                      className="mt-2 block w-full rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-black/30 px-3 py-2 text-slate-900 dark:text-white focus:border-indigo-500 dark:focus:border-white/40 focus:outline-none"
                    >
                      <option value="">Select</option>
                      {SOCIAL_PLATFORMS.map((platform) => (
                        <option key={platform} value={platform}>
                          {platform}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block text-sm font-medium text-slate-700 dark:text-white/80">
                    URL
                    <input
                      type="text"
                      value={row.url}
                      onChange={onSocialChange(index, 'url')}
                      placeholder="https://..."
                      className="mt-2 block w-full rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-black/30 px-3 py-2 text-slate-900 dark:text-white focus:border-indigo-500 dark:focus:border-white/40 focus:outline-none"
                    />
                  </label>

                  <button
                    type="button"
                    onClick={() => removeSocialRow(index)}
                    className="mt-7 rounded-full border border-slate-300 dark:border-white/20 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-white hover:bg-slate-100 dark:hover:bg-white/10"
                  >
                    Remove
                  </button>
                </div>
                {errors[`socials.${index}`] && (
                  <p className="text-xs text-rose-500 dark:text-rose-300">{errors[`socials.${index}`]}</p>
                )}
              </div>
            ))}
          </div>

          <label className="block text-sm font-medium text-slate-700 dark:text-white/80">
            About Me
            <textarea
              value={form.aboutMe}
              onChange={onFieldChange('aboutMe')}
              rows={4}
              className="mt-2 block w-full rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-black/30 px-3 py-2 text-slate-900 dark:text-white focus:border-indigo-500 dark:focus:border-white/40 focus:outline-none"
            />
            {errors.aboutMe && <p className="text-xs text-rose-500 dark:text-rose-300">{errors.aboutMe}</p>}
          </label>

          <label className="block text-sm font-medium text-slate-700 dark:text-white/80">
            Profile Photo
            <input
              type="file"
              ref={profilePhotoInputRef}
              accept="image/*"
              onChange={onPhotoChange}
              data-testid="apply-artist-profile-photo-input"
              className="mt-2 block w-full rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-black/30 px-3 py-2 text-slate-900 dark:text-white file:mr-3 file:rounded-full file:border-0 file:bg-indigo-100 dark:file:bg-white file:px-3 file:py-1 file:text-xs file:font-semibold file:text-indigo-700 dark:file:text-black"
            />
          </label>

          <label className="block text-sm font-medium text-slate-700 dark:text-white/80">
            Message For Fans
            <textarea
              value={form.messageForFans}
              onChange={onFieldChange('messageForFans')}
              rows={4}
              className="mt-2 block w-full rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-black/30 px-3 py-2 text-slate-900 dark:text-white focus:border-indigo-500 dark:focus:border-white/40 focus:outline-none"
            />
            {errors.messageForFans && <p className="text-xs text-rose-500 dark:text-rose-300">{errors.messageForFans}</p>}
          </label>

          <button
            type="submit"
            disabled={submitting}
            data-testid="apply-artist-submit"
            className="w-full rounded-full bg-indigo-600 dark:bg-white px-4 py-2 text-sm font-semibold text-white dark:text-black transition hover:bg-indigo-700 dark:hover:bg-white/90 disabled:opacity-50"
          >
            {submitting ? 'Submitting...' : 'Request Onboarding'}
          </button>
        </form>
      </Container>
    </Page>
  );
}
