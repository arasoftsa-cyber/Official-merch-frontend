import React, { useCallback, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiFetch } from '../shared/api/http';
import { getAccessToken } from '../shared/auth/tokenStore';
import ErrorState from '../components/ux/ErrorState';
import { Container, Page } from '../ui/Page';

const initialFields = {
  artistName: '',
  handleSuggestion: '',
  contactEmail: '',
  contactPhone: '',
  socials: '',
  pitch: '',
};

type FormFields = typeof initialFields;

const hasEmail = (value: string) => value.includes('@');

export default function ApplyArtistPage() {
  const navigate = useNavigate();
  const [fields, setFields] = useState<FormFields>(initialFields);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success'>('idle');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const loggedIn = Boolean(getAccessToken());

  const trimmedName = fields.artistName.trim();
  const canSubmit = useMemo(() => Boolean(trimmedName), [trimmedName]);

  const handleChange =
    (field: keyof FormFields) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setFields((prev) => ({ ...prev, [field]: event.target.value }));
    };

  const validate = useCallback(() => {
    const next: Record<string, string> = {};
    if (!trimmedName) {
      next.artistName = 'Artist name is required.';
    }
    if (!fields.contactEmail.trim() && !fields.contactPhone.trim()) {
      next.contactEmail = 'Provide at least one contact method.';
      next.contactPhone = 'Provide at least one contact method.';
    }
    if (fields.contactEmail.trim() && !hasEmail(fields.contactEmail.trim())) {
      next.contactEmail = 'Enter a valid email.';
    }
    return next;
  }, [fields.contactEmail, fields.contactPhone, trimmedName]);

  const handleSubmit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (status === 'submitting') return;
      if (!loggedIn) {
        navigate('/login?returnTo=%2Fapply%2Fartist');
        return;
      }
      const validation = validate();
      if (Object.keys(validation).length) {
        setErrors(validation);
        return;
      }
      setErrors({});
      setSubmitError(null);
      setStatus('submitting');
      try {
      const socialValue = fields.socials.trim();
      await apiFetch('/api/artist-access-requests', {
        method: 'POST',
        body: {
          artistName: fields.artistName.trim(),
          handle: fields.handleSuggestion.trim() || null,
          contactEmail: fields.contactEmail.trim() || null,
          contactPhone: fields.contactPhone.trim() || null,
          socials: socialValue ? { link: socialValue } : null,
          pitch: fields.pitch.trim() || null,
        },
      });
      setStatus('success');
    } catch (err: any) {
      setSubmitError(err?.message ?? 'Unable to submit your request.');
      setStatus('idle');
      }
    },
    [fields, loggedIn, navigate, status, validate]
  );

  if (status === 'success') {
    return (
      <Page>
        <Container className="space-y-4">
          <h1 className="text-3xl font-semibold text-white">Request Sent</h1>
          <p className="text-white/70">
            Admin will review and contact you.
          </p>
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
        {submitError && <ErrorState message={submitError} />}
        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="block text-sm font-medium text-white/80">
            Artist Name *
            <input
              type="text"
              value={fields.artistName}
              onChange={handleChange('artistName')}
              className="mt-2 block w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white focus:border-white/40 focus:outline-none"
              placeholder="e.g. Nova Maker"
              aria-invalid={Boolean(errors.artistName)}
            />
            {errors.artistName && <p className="text-xs text-rose-300">{errors.artistName}</p>}
          </label>
          <label className="block text-sm font-medium text-white/80">
            Handle Suggestion
            <input
              type="text"
              value={fields.handleSuggestion}
              onChange={handleChange('handleSuggestion')}
              className="mt-2 block w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white focus:border-white/40 focus:outline-none"
              placeholder="Optional"
            />
          </label>
          <label className="block text-sm font-medium text-white/80">
            Email
            <input
              type="email"
              value={fields.contactEmail}
              onChange={handleChange('contactEmail')}
              className="mt-2 block w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white focus:border-white/40 focus:outline-none"
              placeholder="Optional"
              aria-invalid={Boolean(errors.contactEmail)}
            />
            {errors.contactEmail && <p className="text-xs text-rose-300">{errors.contactEmail}</p>}
          </label>
          <label className="block text-sm font-medium text-white/80">
            Phone
            <input
              type="tel"
              value={fields.contactPhone}
              onChange={handleChange('contactPhone')}
              className="mt-2 block w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white focus:border-white/40 focus:outline-none"
              placeholder="Optional"
              aria-invalid={Boolean(errors.contactPhone)}
            />
            {errors.contactPhone && <p className="text-xs text-rose-300">{errors.contactPhone}</p>}
          </label>
          <label className="block text-sm font-medium text-white/80">
            Socials
            <input
              type="text"
              value={fields.socials}
              onChange={handleChange('socials')}
              className="mt-2 block w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white focus:border-white/40 focus:outline-none"
              placeholder="Optional"
            />
          </label>
          <label className="block text-sm font-medium text-white/80">
            Pitch
            <textarea
              value={fields.pitch}
              onChange={handleChange('pitch')}
              rows={4}
              className="mt-2 block w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white focus:border-white/40 focus:outline-none"
              placeholder="Why you want to work with OfficialMerch"
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
              disabled={!canSubmit || status === 'submitting'}
              className="w-full rounded-full bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-white/90 disabled:opacity-50"
              aria-busy={status === 'submitting'}
            >
              {status === 'submitting' ? 'Submitting...' : 'Submit application'}
            </button>
          )}
        </form>
      </Container>
    </Page>
  );
}

