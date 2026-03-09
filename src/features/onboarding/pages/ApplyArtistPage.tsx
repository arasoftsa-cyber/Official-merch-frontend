import React, { useEffect, useRef, useState } from 'react';
import ErrorState from '../../../shared/components/ux/ErrorState';
import { API_BASE } from '../../../shared/api/http';
import { Container, Page } from '../../../shared/ui/Page';
import PlanTypeSelector from './ApplyArtistPlanTypeSelector';

import type { FormState, SocialRow, ValidationErrors } from './ApplyArtistForm.utils';
import {
  INITIAL_FORM,
  MAX_SOCIAL_ROWS,
  SOCIAL_PLATFORMS,
  buildSocialsArray,
  mapValidationDetails,
  normalizeHandle,
  normalizePhone,
  validateFormState,
} from './ApplyArtistForm.utils';
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

  const onFieldChange =
    (field: keyof Omit<FormState, 'socials' | 'profilePhoto'>) =>
      (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const value = field === 'phone' ? normalizePhone(event.target.value) : event.target.value;
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

  const selectPlanType = (requestedPlanType: 'basic' | 'advanced') => {
    setForm((prev) => ({ ...prev, requestedPlanType }));
    setErrors((prev) => {
      if (!prev.requestedPlanType) return prev;
      const next = { ...prev };
      delete next.requestedPlanType;
      return next;
    });
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

    const normalizedPhone = normalizePhone(form.phone);
    const formToValidate: FormState = { ...form, phone: normalizedPhone };
    const nextErrors = validateFormState(formToValidate);
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
        fd.append('phone', formToValidate.phone);
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
            phone: formToValidate.phone,
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

        <form className="space-y-4" onSubmit={submit} noValidate>
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

          <PlanTypeSelector
            value={form.requestedPlanType}
            onSelect={selectPlanType}
            error={errors.requestedPlanType}
          />

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
