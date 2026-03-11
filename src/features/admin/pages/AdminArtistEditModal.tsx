import React, { useEffect, useMemo, useState } from 'react';
import { apiFetch, apiFetchForm } from '../../../shared/api/http';
import { resolveMediaUrl } from '../../../shared/utils/media';
import ArtistEditAlerts from '../components/artistEdit/ArtistEditAlerts';
import ArtistEditFooter from '../components/artistEdit/ArtistEditFooter';
import ArtistEditHeader from '../components/artistEdit/ArtistEditHeader';
import ArtistIdentitySection from '../components/artistEdit/ArtistIdentitySection';
import ArtistProfilePhotoSection from '../components/artistEdit/ArtistProfilePhotoSection';
import ArtistSocialsSection from '../components/artistEdit/ArtistSocialsSection';
import ArtistSubscriptionSection from '../components/artistEdit/ArtistSubscriptionSection';
import {
  ADVANCED_PAYMENT_MODE_OPTIONS,
  createInitialFormState,
  createInitialSubscriptionFormState,
  DEFAULT_CAPABILITIES,
  DEFAULT_STATUS_OPTIONS,
  EMPTY_SOCIAL_ROW,
  isDateOnly,
  isValidEmail,
  normalizeDetail,
  SUBSCRIPTION_STATUS_OPTIONS,
  toDateOnly,
  toText,
  type ArtistDetail,
  type ArtistFormState,
  type SocialRow,
  type SubscriptionFormState,
} from '../components/artistEdit/types';
import {
  normalizeAdminArtistSubscription,
  useAdminArtistSubscription,
} from '../hooks/useAdminArtistSubscription';
import {
  buildAdminArtistUpdatePayload,
  normalizeSocialRows,
} from '../lib/adminArtistUpdatePayload';

type Props = {
  open: boolean;
  artistId: string | null;
  onClose: () => void;
  onSaved?: () => void | Promise<void>;
};

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
          <ArtistEditHeader onClose={onClose} />

          <div className="grow overflow-y-auto px-6 py-6 pr-5">
            <ArtistEditAlerts error={error} info={info} loading={loading} />

            {!loading && detail && (
              <div className="space-y-4">
                <div className="grid gap-6 md:grid-cols-2">
                  <ArtistIdentitySection
                    form={form}
                    caps={caps}
                    emailEditable={emailEditable}
                    statusOptions={statusOptions}
                    saving={saving}
                    fieldErrors={fieldErrors}
                    setForm={setForm}
                    focusOnPointerDown={focusOnPointerDown}
                  />
                  <ArtistSocialsSection
                    socials={form.socials}
                    caps={caps}
                    saving={saving}
                    onAddSocial={addSocial}
                    onRemoveSocial={removeSocial}
                    onUpdateSocial={updateSocial}
                    focusOnPointerDown={focusOnPointerDown}
                  />
                  <ArtistProfilePhotoSection
                    form={form}
                    caps={caps}
                    saving={saving}
                    previewUrl={previewUrl}
                    resolvedProfilePreviewUrl={resolvedProfilePreviewUrl}
                    onProfilePhotoUrlChange={(value) =>
                      setForm((prev) => ({ ...prev, profilePhotoUrl: value }))
                    }
                    onProfilePhotoFileChange={setProfilePhotoFile}
                  />
                </div>

                <ArtistSubscriptionSection
                  subscription={subscription}
                  subscriptionLoading={subscriptionLoading}
                  subscriptionLoadError={subscriptionLoadError}
                  subscriptionForm={subscriptionForm}
                  setSubscriptionForm={setSubscriptionForm}
                  subscriptionFieldErrors={subscriptionFieldErrors}
                  subscriptionSaveError={subscriptionSaveError}
                  saving={saving}
                  isAdvancedSubscription={isAdvancedSubscription}
                  focusOnPointerDown={focusOnPointerDown}
                />
              </div>
            )}
          </div>

          <ArtistEditFooter
            saving={saving}
            loading={loading}
            hasDetail={Boolean(detail)}
            onClose={onClose}
            onSave={save}
          />
        </div>
      </div>
    </div>
  );
}
