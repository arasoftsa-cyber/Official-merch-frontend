import React from 'react';
import ErrorState from '../../../shared/components/ux/ErrorState';
import { useArtistAccessRequestForm } from '../hooks/useArtistAccessRequestForm';
import PlanTypeSelector from '../pages/ApplyArtistPlanTypeSelector';
import { SOCIAL_PLATFORMS } from '../pages/ApplyArtistForm.utils';

type ArtistAccessRequestFormProps = {
  onSuccess?: () => void;
  submitLabel?: string;
  successMessage?: string;
};

export default function ArtistAccessRequestForm({
  onSuccess,
  submitLabel = 'Request Onboarding',
  successMessage = "Request submitted. We'll reach out soon.",
}: ArtistAccessRequestFormProps) {
  const {
    form,
    errors,
    submitError,
    submitting,
    success,
    canAddSocial,
    profilePhotoInputRef,
    onFieldChange,
    onSocialChange,
    addSocialRow,
    removeSocialRow,
    selectPlanType,
    onPhotoChange,
    submit,
  } = useArtistAccessRequestForm({ onSuccess });

  return (
    <>
      {submitError && <ErrorState message={submitError} />}
      {success && (
        <p className="rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
          {successMessage}
        </p>
      )}

      <form className="space-y-4" onSubmit={submit} noValidate>
        <label className="block text-sm font-medium text-slate-700 dark:text-white/80">
          Artist Name *
          <input
            type="text"
            value={form.artistName}
            onChange={onFieldChange('artistName')}
            className="mt-2 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-white/10 dark:bg-black/30 dark:text-white dark:focus:border-white/40"
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
            className="mt-2 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-white/10 dark:bg-black/30 dark:text-white dark:focus:border-white/40"
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
            className="mt-2 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-white/10 dark:bg-black/30 dark:text-white dark:focus:border-white/40"
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
            className="mt-2 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-white/10 dark:bg-black/30 dark:text-white dark:focus:border-white/40"
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
              className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50 dark:border-white/20 dark:text-white dark:hover:bg-white/10"
            >
              Add row
            </button>
          </div>

          {form.socials.map((row, index) => (
            <div
              key={`social-row-${index}`}
              className="space-y-2 rounded-xl border border-slate-300 p-3 dark:border-white/10"
            >
              <div className="grid gap-3 md:grid-cols-[1fr_2fr_auto] md:items-start">
                <label className="block text-sm font-medium text-slate-700 dark:text-white/80">
                  Platform
                  <select
                    value={row.platform}
                    onChange={onSocialChange(index, 'platform')}
                    className="mt-2 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-white/10 dark:bg-black/30 dark:text-white dark:focus:border-white/40"
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
                    className="mt-2 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-white/10 dark:bg-black/30 dark:text-white dark:focus:border-white/40"
                  />
                </label>

                <button
                  type="button"
                  onClick={() => removeSocialRow(index)}
                  className="mt-7 rounded-full border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-white/20 dark:text-white dark:hover:bg-white/10"
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
            className="mt-2 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-white/10 dark:bg-black/30 dark:text-white dark:focus:border-white/40"
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
            className="mt-2 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 file:mr-3 file:rounded-full file:border-0 file:bg-indigo-100 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-indigo-700 dark:border-white/10 dark:bg-black/30 dark:text-white dark:file:bg-white dark:file:text-black"
          />
        </label>

        <label className="block text-sm font-medium text-slate-700 dark:text-white/80">
          Message For Fans
          <textarea
            value={form.messageForFans}
            onChange={onFieldChange('messageForFans')}
            rows={4}
            className="mt-2 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-white/10 dark:bg-black/30 dark:text-white dark:focus:border-white/40"
          />
          {errors.messageForFans && (
            <p className="text-xs text-rose-500 dark:text-rose-300">{errors.messageForFans}</p>
          )}
        </label>

        <button
          type="submit"
          disabled={submitting}
          data-testid="apply-artist-submit"
          className="w-full rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-white/90"
        >
          {submitting ? 'Submitting...' : submitLabel}
        </button>
      </form>
    </>
  );
}
