import React, { useEffect, useMemo, useState } from 'react';
import { apiFetch, apiFetchForm } from '../../shared/api/http';
import { resolveMediaUrl } from '../../shared/utils/media';
import {
  normalizeAdminArtistSubscription,
  useAdminArtistSubscription,
} from './hooks/useAdminArtistSubscription';
import {
  buildAdminArtistUpdatePayload,
  normalizeSocialRows,
} from './adminArtistUpdatePayload';

type SocialRow = {
  platform: string;
  value: string;
};

type ArtistCapabilities = {
  canEditName: boolean;
  canEditHandle: boolean;
  canEditEmail: boolean;
  canEditStatus: boolean;
  canEditFeatured: boolean;
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

type SubscriptionFormState = {
  status: string;
  endDate: string;
  paymentMode: string;
  transactionId: string;
};

const DEFAULT_CAPABILITIES: ArtistCapabilities = {
  canEditName: true,
  canEditHandle: false,
  canEditEmail: true,
  canEditStatus: true,
  canEditFeatured: true,
  canEditPhone: true,
  canEditAboutMe: true,
  canEditMessageForFans: true,
  canEditSocials: true,
  canEditProfilePhoto: true,
  canUploadProfilePhoto: false,
};

const DEFAULT_STATUS_OPTIONS = ['approved', 'active', 'inactive', 'rejected'];
const SUBSCRIPTION_STATUS_OPTIONS = ['active', 'expired', 'cancelled'] as const;
const ADVANCED_PAYMENT_MODE_OPTIONS = ['cash', 'online'] as const;
const EMPTY_SOCIAL_ROW: SocialRow = { platform: '', value: '' };

const toText = (value: unknown) => String(value ?? '').trim();

const toTitleCase = (value: unknown) => {
  const text = toText(value).toLowerCase();
  if (!text) return '-';
  return text
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

const toDateOnly = (value: unknown) => {
  const text = toText(value);
  if (!text) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  if (/^\d{4}-\d{2}-\d{2}T/.test(text)) return text.slice(0, 10);
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
};

const isDateOnly = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);
const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

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
    message_for_fans: String(row?.message_for_fans ?? row?.messageForFans ?? '').trim(),
    profilePhotoUrl:
      resolveMediaUrl(String(row?.profilePhotoUrl ?? row?.profile_photo_url ?? '').trim() || null) ?? '',
    socials,
    statusOptions: statusOptions.length ? statusOptions : DEFAULT_STATUS_OPTIONS,
    capabilities: { ...DEFAULT_CAPABILITIES, ...(row?.capabilities || {}) },
  };
};

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

const createInitialSubscriptionFormState = (): SubscriptionFormState => ({
  status: 'active',
  endDate: '',
  paymentMode: 'NA',
  transactionId: 'NA',
});

export default function AdminArtistEditModal({ open, artistId, onClose, onSaved }: Props) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [subscriptionFieldErrors, setSubscriptionFieldErrors] = useState<Record<string, string>>(
    {}
  );
  const [subscriptionSaveError, setSubscriptionSaveError] = useState<string | null>(null);

  const [detail, setDetail] = useState<ArtistDetail | null>(null);
  const [form, setForm] = useState<ArtistFormState>(createInitialFormState);
  const [profilePhotoFile, setProfilePhotoFile] = useState<File | null>(null);
  const [subscriptionForm, setSubscriptionForm] = useState<SubscriptionFormState>(
    createInitialSubscriptionFormState
  );

  const {
    subscription,
    setSubscription,
    loading: subscriptionLoading,
    error: subscriptionLoadError,
  } = useAdminArtistSubscription(artistId, Boolean(open && artistId));

  useEffect(() => {
    if (!open || !artistId) return;
    let active = true;
    (async () => {
      setLoading(true);
      setSaving(false);
      setError(null);
      setInfo(null);
      setFieldErrors({});
      setSubscriptionFieldErrors({});
      setSubscriptionSaveError(null);
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

  useEffect(() => {
    if (!subscription) {
      setSubscriptionForm(createInitialSubscriptionFormState());
      return;
    }
    const planType = toText(subscription.approvedPlanType).toLowerCase();
    setSubscriptionForm({
      status: toText(subscription.status).toLowerCase() || 'active',
      endDate: toDateOnly(subscription.endDate),
      paymentMode: planType === 'advanced' ? toText(subscription.paymentMode).toLowerCase() : 'NA',
      transactionId: planType === 'advanced' ? toText(subscription.transactionId) : 'NA',
    });
  }, [subscription]);

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
  const approvedPlanType = toText(subscription?.approvedPlanType).toLowerCase();
  const isAdvancedSubscription = approvedPlanType === 'advanced';

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

  const focusOnPointerDown = (
    event: React.MouseEvent<HTMLSelectElement | HTMLTextAreaElement | HTMLInputElement>
  ) => {
    const target = event.currentTarget;
    if (document.activeElement !== target) {
      requestAnimationFrame(() => target.focus());
    }
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

    const nextSubscriptionErrors: Record<string, string> = {};
    if (subscription) {
      const normalizedStatus = toText(subscriptionForm.status).toLowerCase();
      const normalizedEndDate = toDateOnly(subscriptionForm.endDate);
      const normalizedStartDate = toDateOnly(subscription.startDate);
      const basePaymentMode = toText(subscription.paymentMode).toLowerCase();
      const baseTransactionId = toText(subscription.transactionId);
      const nextPaymentMode = toText(subscriptionForm.paymentMode).toLowerCase();
      const nextTransactionId = toText(subscriptionForm.transactionId);
      const paymentChanged =
        nextPaymentMode !== basePaymentMode || nextTransactionId !== baseTransactionId;
      const paymentInvalid =
        !ADVANCED_PAYMENT_MODE_OPTIONS.includes(
          basePaymentMode as (typeof ADVANCED_PAYMENT_MODE_OPTIONS)[number]
        ) || !baseTransactionId;

      if (
        !SUBSCRIPTION_STATUS_OPTIONS.includes(
          normalizedStatus as (typeof SUBSCRIPTION_STATUS_OPTIONS)[number]
        )
      ) {
        nextSubscriptionErrors.status = 'Subscription status is invalid.';
      }
      if (!isDateOnly(normalizedEndDate)) {
        nextSubscriptionErrors.endDate = 'End date must be YYYY-MM-DD.';
      } else if (normalizedStartDate && normalizedEndDate < normalizedStartDate) {
        nextSubscriptionErrors.endDate = 'End date must be on or after start date.';
      }

      if (approvedPlanType === 'advanced' && (paymentChanged || paymentInvalid)) {
        if (
          !ADVANCED_PAYMENT_MODE_OPTIONS.includes(
            nextPaymentMode as (typeof ADVANCED_PAYMENT_MODE_OPTIONS)[number]
          )
        ) {
          nextSubscriptionErrors.paymentMode = 'Payment mode must be cash or online.';
        }
        if (!nextTransactionId) {
          nextSubscriptionErrors.transactionId = 'Transaction ID is required for advanced plan.';
        }
      }
    }
    setSubscriptionFieldErrors(nextSubscriptionErrors);
    setSubscriptionSaveError(null);
    setInfo(null);

    if (Object.keys(nextErrors).length > 0 || Object.keys(nextSubscriptionErrors).length > 0) {
      setError('Please fix the highlighted fields.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const artistPatchPayload = buildAdminArtistUpdatePayload({
        initial: {
          name: detail.name,
          handle: detail.handle,
          email: detail.email,
          status: detail.status,
          is_featured: detail.is_featured,
          phone: detail.phone,
          about: detail.about,
          message_for_fans: detail.message_for_fans,
          socials: detail.socials,
          profilePhotoUrl: detail.profilePhotoUrl,
        },
        current: {
          name: form.name,
          handle: form.handle,
          email: form.email,
          status: form.status,
          is_featured: form.is_featured,
          phone: form.phone,
          about: form.about,
          message_for_fans: form.message_for_fans,
          socials: normalizeSocialRows(form.socials),
          profilePhotoUrl: form.profilePhotoUrl,
        },
        capabilities: {
          canEditName: caps.canEditName,
          canEditHandle: caps.canEditHandle,
          canEditEmail: caps.canEditEmail,
          canEditStatus: caps.canEditStatus,
          canEditFeatured: caps.canEditFeatured,
          canEditPhone: caps.canEditPhone,
          canEditAboutMe: caps.canEditAboutMe,
          canEditMessageForFans: caps.canEditMessageForFans,
          canEditSocials: caps.canEditSocials,
          canEditProfilePhoto: caps.canEditProfilePhoto,
        },
      });

      if (caps.canEditProfilePhoto) {
        if (profilePhotoFile && caps.canUploadProfilePhoto) {
          const fd = new FormData();
          fd.append('file', profilePhotoFile);
          const upload = await apiFetchForm('/media-assets', fd, { method: 'POST' });
          const uploadedUrl = String(upload?.publicUrl ?? upload?.public_url ?? '').trim();
          if (uploadedUrl) {
            artistPatchPayload.profile_photo_url = uploadedUrl;
          } else {
            const currentProfileUrl = String(form.profilePhotoUrl || '').trim();
            artistPatchPayload.profile_photo_url = currentProfileUrl || null;
          }
          if (upload?.id) artistPatchPayload.profile_photo_media_asset_id = upload.id;
        }
      }

      const subscriptionPatchPayload: Record<string, string> = {};
      if (subscription?.id) {
        const nextStatus = toText(subscriptionForm.status).toLowerCase();
        if (nextStatus !== toText(subscription.status).toLowerCase()) {
          subscriptionPatchPayload.status = nextStatus;
        }
        const nextEndDate = toDateOnly(subscriptionForm.endDate);
        if (nextEndDate && nextEndDate !== toDateOnly(subscription.endDate)) {
          subscriptionPatchPayload.endDate = nextEndDate;
        }

        if (approvedPlanType === 'advanced') {
          const basePaymentMode = toText(subscription.paymentMode).toLowerCase();
          const baseTransactionId = toText(subscription.transactionId);
          const nextPaymentMode = toText(subscriptionForm.paymentMode).toLowerCase();
          const nextTransactionId = toText(subscriptionForm.transactionId);
          const paymentChanged =
            nextPaymentMode !== basePaymentMode || nextTransactionId !== baseTransactionId;
          const paymentInvalid =
            !ADVANCED_PAYMENT_MODE_OPTIONS.includes(
              basePaymentMode as (typeof ADVANCED_PAYMENT_MODE_OPTIONS)[number]
            ) || !baseTransactionId;

          if (paymentChanged || paymentInvalid) {
            subscriptionPatchPayload.paymentMode = nextPaymentMode;
            subscriptionPatchPayload.transactionId = nextTransactionId;
          }
        }
      }

      if (
        Object.keys(artistPatchPayload).length === 0 &&
        Object.keys(subscriptionPatchPayload).length === 0
      ) {
        setInfo('No changes to save.');
        return;
      }

      if (Object.keys(artistPatchPayload).length > 0) {
        await apiFetch(`/admin/artists/${artistId}`, {
          method: 'PATCH',
          body: artistPatchPayload as any,
        });
      }

      if (subscription?.id && Object.keys(subscriptionPatchPayload).length > 0) {
        try {
          const updated = await apiFetch(`/admin/artist-subscriptions/${subscription.id}`, {
            method: 'PATCH',
            body: subscriptionPatchPayload as any,
          });
          setSubscription(normalizeAdminArtistSubscription(updated));
        } catch (err: any) {
          const status = Number(err?.status || 0);
          const message = String(err?.message ?? '').trim() || 'Failed to update subscription.';
          setSubscriptionSaveError(
            status === 409
              ? `Subscription update conflict: ${message}`
              : `Subscription update failed: ${message}`
          );
          setError('Artist saved, but subscription update failed.');
          return;
        }
      }

      await onSaved?.();
      onClose();
    } catch (err: any) {
      if (String(err?.message ?? '').trim().toLowerCase() === 'no_fields') {
        setError(null);
        setInfo('No changes to save.');
      } else {
        setError(err?.message ?? 'Failed to save artist.');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="relative z-10 pointer-events-auto w-full max-w-3xl max-h-[90vh] overflow-hidden rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950/95 shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="flex max-h-[90vh] flex-col">
          <div className="shrink-0 border-b border-slate-200 dark:border-white/10 px-6 py-4 bg-slate-50 dark:bg-white/5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Edit artist</h2>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-slate-300 dark:border-white/20 bg-white dark:bg-white/5 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition shadow-sm"
              >
                Close
              </button>
            </div>
          </div>

          <div className="grow overflow-y-auto px-6 py-6 pr-5">
            {error && <p className="mb-4 rounded-lg bg-rose-50 dark:bg-rose-500/10 px-4 py-2 text-sm font-medium text-rose-600 dark:text-rose-300 border border-rose-200 dark:border-rose-500/20">{error}</p>}
            {info && <p className="mb-4 rounded-lg bg-sky-50 dark:bg-sky-500/10 px-4 py-2 text-sm font-medium text-sky-700 dark:text-sky-200 border border-sky-200 dark:border-sky-500/20">{info}</p>}
            {loading && <p className="text-sm text-slate-500 dark:text-slate-300 animate-pulse">Loading artist details...</p>}

            {!loading && detail && (
              <div className="space-y-4">
                <div className="grid gap-6 md:grid-cols-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Name
                    <input
                      value={form.name}
                      onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                      disabled={!caps.canEditName || saving}
                      className="mt-1.5 w-full rounded-xl border border-slate-200 dark:border-white/15 bg-slate-50 dark:bg-black/20 px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 dark:focus:ring-emerald-500 outline-none transition disabled:opacity-50"
                    />
                    {fieldErrors.name && <p className="mt-1 text-xs font-medium text-rose-600 dark:text-rose-300">{fieldErrors.name}</p>}
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
                      <p className="mt-1 text-[10px] lowercase text-slate-400 dark:text-slate-500">Handle cannot be changed after creation.</p>
                    )}
                    {fieldErrors.handle && <p className="mt-1 text-xs font-medium text-rose-600 dark:text-rose-300">{fieldErrors.handle}</p>}
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
                      <p className="mt-1 text-[10px] lowercase text-slate-400 dark:text-slate-500">Email is not editable for this artist.</p>
                    )}
                    {fieldErrors.email && <p className="mt-1 text-xs font-medium text-rose-600 dark:text-rose-300">{fieldErrors.email}</p>}
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
                    {fieldErrors.status && <p className="mt-1 text-xs font-medium text-rose-600 dark:text-rose-300">{fieldErrors.status}</p>}
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

                  <fieldset className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/5 p-5 md:col-span-2">
                    <legend className="px-2 text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 flex items-center gap-2">
                      <span className="w-1 h-3 bg-indigo-500 dark:bg-emerald-500 rounded-full"></span>
                      Socials
                    </legend>
                    <div className="space-y-3">
                      {form.socials.map((social, index) => (
                        <div key={`social-${index}`} className="grid gap-3 md:grid-cols-[1fr_2fr_auto]">
                          <input
                            value={social.platform}
                            onChange={(event) => updateSocial(index, 'platform', event.target.value)}
                            onMouseDown={focusOnPointerDown}
                            disabled={!caps.canEditSocials || saving}
                            placeholder="Platform"
                            className="rounded-xl border border-slate-200 dark:border-white/15 bg-white dark:bg-black/20 px-4 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 dark:focus:ring-emerald-500 outline-none transition"
                          />
                          <input
                            value={social.value}
                            onChange={(event) => updateSocial(index, 'value', event.target.value)}
                            onMouseDown={focusOnPointerDown}
                            disabled={!caps.canEditSocials || saving}
                            placeholder="URL / Handle"
                            className="rounded-xl border border-slate-200 dark:border-white/15 bg-white dark:bg-black/20 px-4 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 dark:focus:ring-emerald-500 outline-none transition"
                          />
                          <button
                            type="button"
                            onClick={() => removeSocial(index)}
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
                      onClick={addSocial}
                      disabled={!caps.canEditSocials || saving}
                      className="mt-4 rounded-xl border border-slate-300 dark:border-white/20 bg-white dark:bg-white/5 px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition shadow-sm inline-flex items-center gap-2"
                    >
                      <span className="text-base">+</span> Add Social
                    </button>
                  </fieldset>

                  <fieldset className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/5 p-5 md:col-span-2">
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
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Image URL</label>
                          <input
                            value={form.profilePhotoUrl}
                            onChange={(event) =>
                              setForm((prev) => ({ ...prev, profilePhotoUrl: event.target.value }))
                            }
                            disabled={!caps.canEditProfilePhoto || saving}
                            placeholder="https://example.com/photo.jpg"
                            className="w-full rounded-xl border border-slate-200 dark:border-white/15 bg-white dark:bg-black/20 px-4 py-2 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 dark:focus:ring-emerald-500 outline-none transition disabled:bg-slate-100 dark:disabled:bg-black/30 disabled:text-slate-400"
                          />
                        </div>
                        {caps.canUploadProfilePhoto && (
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Upload File</label>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(event) => {
                                const file = event.target.files?.[0] || null;
                                setProfilePhotoFile(file);
                              }}
                              disabled={!caps.canEditProfilePhoto || saving}
                              className="block w-full rounded-xl border border-slate-200 dark:border-white/15 bg-white dark:bg-black/20 px-4 py-2 text-sm text-slate-900 dark:text-white file:mr-4 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-indigo-50 dark:file:bg-emerald-500/10 file:text-indigo-600 dark:file:text-emerald-300 hover:file:bg-indigo-100 dark:hover:file:bg-emerald-500/20 cursor-pointer disabled:opacity-50"
                            />
                          </div>
                        )}
                        {!caps.canEditProfilePhoto && (
                          <p className="text-[10px] lowercase text-slate-400 dark:text-slate-500 italic">Profile photo is not editable on this deployment.</p>
                        )}
                      </div>
                    </div>
                  </fieldset>
                </div>

                <fieldset className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/5 p-5">
                  <legend className="px-2 text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 flex items-center gap-2">
                    <span className="w-1 h-3 bg-indigo-500 dark:bg-emerald-500 rounded-full"></span>
                    Subscription
                  </legend>
                  {subscriptionLoading && <p className="text-sm text-slate-500 dark:text-slate-300 animate-pulse">Loading subscription...</p>}
                  {!subscriptionLoading && subscriptionLoadError && (
                    <p className="text-sm text-rose-600 dark:text-rose-300 font-medium">{subscriptionLoadError}</p>
                  )}
                  {!subscriptionLoading && !subscriptionLoadError && !subscription && (
                    <p className="text-sm text-slate-500 dark:text-slate-400 italic">No active subscription</p>
                  )}
                  {!subscriptionLoading && !subscriptionLoadError && subscription && (
                    <div className="mt-4 grid gap-5 md:grid-cols-2">
                      <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-black/20 p-3">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Requested Plan</p>
                        <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{toTitleCase(subscription.requestedPlanType)}</p>
                      </div>
                      <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-black/20 p-3">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Approved Plan</p>
                        <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{toTitleCase(subscription.approvedPlanType)}</p>
                      </div>
                      <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-black/20 p-3">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Start Date</p>
                        <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{toDateOnly(subscription.startDate) || '-'}</p>
                      </div>

                      <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Subscription Status
                        <select
                          value={subscriptionForm.status}
                          onChange={(event) =>
                            setSubscriptionForm((prev) => ({ ...prev, status: event.target.value }))
                          }
                          onMouseDown={focusOnPointerDown}
                          disabled={saving}
                          className="mt-1.5 w-full rounded-xl border border-slate-200 dark:border-white/15 bg-white dark:bg-black/20 px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 dark:focus:ring-emerald-500 outline-none transition appearance-none cursor-pointer"
                        >
                          {SUBSCRIPTION_STATUS_OPTIONS.map((option) => (
                            <option key={option} value={option} className="dark:bg-slate-900">
                              {option}
                            </option>
                          ))}
                        </select>
                        {subscriptionFieldErrors.status && (
                          <p className="mt-1 text-xs font-medium text-rose-600 dark:text-rose-300">{subscriptionFieldErrors.status}</p>
                        )}
                      </label>

                      <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        End Date
                        <input
                          type="date"
                          value={subscriptionForm.endDate}
                          onChange={(event) =>
                            setSubscriptionForm((prev) => ({ ...prev, endDate: event.target.value }))
                          }
                          disabled={saving}
                          className="mt-1.5 w-full rounded-xl border border-slate-200 dark:border-white/15 bg-white dark:bg-black/20 px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 dark:focus:ring-emerald-500 outline-none transition"
                        />
                        {subscriptionFieldErrors.endDate && (
                          <p className="mt-1 text-xs font-medium text-rose-600 dark:text-rose-300">{subscriptionFieldErrors.endDate}</p>
                        )}
                      </label>

                      <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Payment Mode
                        <select
                          value={isAdvancedSubscription ? subscriptionForm.paymentMode : 'NA'}
                          onChange={(event) =>
                            setSubscriptionForm((prev) => ({ ...prev, paymentMode: event.target.value }))
                          }
                          onMouseDown={focusOnPointerDown}
                          disabled={!isAdvancedSubscription || saving}
                          className="mt-1.5 w-full rounded-xl border border-slate-200 dark:border-white/15 bg-white dark:bg-black/20 px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 dark:focus:ring-emerald-500 outline-none transition appearance-none cursor-pointer disabled:bg-slate-100 dark:disabled:bg-black/30 disabled:text-slate-400 dark:disabled:text-slate-500"
                        >
                          {isAdvancedSubscription ? (
                            <>
                              <option value="">Select payment mode</option>
                              {ADVANCED_PAYMENT_MODE_OPTIONS.map((option) => (
                                <option key={option} value={option} className="dark:bg-slate-900">
                                  {option}
                                </option>
                              ))}
                            </>
                          ) : (
                            <option value="NA">NA</option>
                          )}
                        </select>
                        {subscriptionFieldErrors.paymentMode && (
                          <p className="mt-1 text-xs font-medium text-rose-600 dark:text-rose-300">{subscriptionFieldErrors.paymentMode}</p>
                        )}
                      </label>

                      <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Transaction ID
                        <input
                          value={isAdvancedSubscription ? subscriptionForm.transactionId : 'NA'}
                          onChange={(event) =>
                            setSubscriptionForm((prev) => ({ ...prev, transactionId: event.target.value }))
                          }
                          disabled={!isAdvancedSubscription || saving}
                          className="mt-1.5 w-full rounded-xl border border-slate-200 dark:border-white/15 bg-white dark:bg-black/20 px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 dark:focus:ring-emerald-500 outline-none transition disabled:bg-slate-100 dark:disabled:bg-black/30 disabled:text-slate-400 dark:disabled:text-slate-500"
                        />
                        {subscriptionFieldErrors.transactionId && (
                          <p className="mt-1 text-xs font-medium text-rose-600 dark:text-rose-300">{subscriptionFieldErrors.transactionId}</p>
                        )}
                      </label>
                    </div>
                  )}
                  {subscriptionSaveError && <p className="mt-4 rounded-lg bg-rose-50 dark:bg-rose-500/10 px-4 py-2 text-xs font-medium text-rose-600 dark:text-rose-300 border border-rose-200 dark:border-rose-500/20">{subscriptionSaveError}</p>}
                </fieldset>
              </div>
            )}
          </div>

          <div className="shrink-0 border-t border-slate-200 dark:border-white/10 px-6 py-4 bg-slate-50 dark:bg-white/5">
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-slate-300 dark:border-white/20 bg-white dark:bg-white/5 px-6 py-2.5 text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition shadow-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={save}
                disabled={saving || loading || !detail}
                className="rounded-xl bg-indigo-600 dark:bg-emerald-500 px-8 py-2.5 text-sm font-bold uppercase tracking-widest text-white shadow-lg shadow-indigo-500/20 dark:shadow-emerald-500/20 hover:bg-indigo-700 dark:hover:bg-emerald-600 transition disabled:opacity-50 disabled:shadow-none"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
