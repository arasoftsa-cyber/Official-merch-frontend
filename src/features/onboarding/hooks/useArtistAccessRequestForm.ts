import React, { useRef, useState } from 'react';
import { submitArtistAccessRequestForm } from '../api/artistAccessRequests';
import type { FormState, SocialRow, ValidationErrors } from '../pages/ApplyArtistForm.utils';
import {
  INITIAL_FORM,
  MAX_SOCIAL_ROWS,
  buildConflictMessage,
  mapValidationDetails,
  normalizeHandle,
  normalizePhone,
  validateFormState,
} from '../pages/ApplyArtistForm.utils';

type UseArtistAccessRequestFormOptions = {
  onSuccess?: () => void;
};

export function useArtistAccessRequestForm(options: UseArtistAccessRequestFormOptions = {}) {
  const { onSuccess } = options;
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const profilePhotoInputRef = useRef<HTMLInputElement | null>(null);

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

  const selectPlanType = (requestedPlanType: 'basic' | 'advanced') => {
    setForm((prev) => ({ ...prev, requestedPlanType }));
    setErrors((prev) => {
      if (!prev.requestedPlanType) return prev;
      const next = { ...prev };
      delete next.requestedPlanType;
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

    try {
      await submitArtistAccessRequestForm({
        ...formToValidate,
        handle: normalizeHandle(form.handle),
      });
    } catch (err: any) {
      const data = err?.payload ?? null;
      const backendMessage =
        typeof data?.error === 'string' && typeof data?.message === 'string'
          ? String(data.message).trim()
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
        setSubmitError(genericSubmitError);
        if (field === 'email' || field === 'phone' || field === 'handle') {
          setErrors((prev) => ({ ...prev, [field]: buildConflictMessage(field) }));
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
    onSuccess?.();
  };

  return {
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
  };
}
