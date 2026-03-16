import { apiFetch, apiFetchForm } from '../../../shared/api/http';
import {
  buildSocialsArray,
  normalizeHandle,
  normalizePhone,
  type FormState,
} from '../pages/ApplyArtistForm.utils';

const trim = (value: string) => value.trim();

const buildCanonicalPayload = (form: FormState) => ({
  artist_name: trim(form.artistName),
  handle: normalizeHandle(form.handle),
  email: trim(form.email).toLowerCase(),
  phone: normalizePhone(form.phone),
  requested_plan_type: trim(form.requestedPlanType),
  about_me: trim(form.aboutMe),
  message_for_fans: trim(form.messageForFans),
  socials: buildSocialsArray(form.socials),
});

export async function submitArtistAccessRequestForm(form: FormState): Promise<void> {
  const payload = buildCanonicalPayload(form);

  if (form.profilePhoto) {
    const formData = new FormData();
    formData.append('artist_name', payload.artist_name);
    formData.append('handle', payload.handle);
    formData.append('email', payload.email);
    formData.append('phone', payload.phone);
    formData.append('requested_plan_type', payload.requested_plan_type);
    formData.append('about_me', payload.about_me);
    formData.append('message_for_fans', payload.message_for_fans);
    formData.append('profile_photo', form.profilePhoto);
    formData.append('socials', JSON.stringify(payload.socials));
    await apiFetchForm('/artist-access-requests', formData, { method: 'POST' });
    return;
  }

  await apiFetch('/artist-access-requests', {
    method: 'POST',
    body: payload,
  });
}
