import { resolveMediaUrl } from '../../../shared/utils/media';
import type { ArtistRequest, ArtistRequestPlanType, ArtistRequestStatus } from './types';

export const normalizeArtistRequestStatus = (value: unknown): ArtistRequestStatus => {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === 'approved' || normalized === 'rejected') return normalized;
  return 'pending';
};

export const normalizePlanType = (value: unknown) => String(value ?? '').trim().toLowerCase();

export const normalizePlan = (value: string): ArtistRequestPlanType => {
  const s = (value || '').toLowerCase().trim();
  if (s === 'advanced') return 'advanced';
  if (s === 'premium') return 'premium';
  return 'basic';
};

const normalizeSocials = (value: any) => {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value
      .map((item) => ({
        platform: String(item?.platform ?? item?.name ?? '').trim(),
        profileLink: String(
          item?.profileLink ?? item?.profile_link ?? item?.url ?? item?.link ?? item?.value ?? ''
        ).trim(),
      }))
      .filter((item) => item.platform || item.profileLink);
  }

  if (typeof value === 'string') {
    try {
      return normalizeSocials(JSON.parse(value));
    } catch {
      const raw = value.trim();
      return raw ? [{ platform: '', profileLink: raw }] : [];
    }
  }

  if (typeof value === 'object') {
    return Object.entries(value)
      .map(([platform, profileLink]) => ({
        platform: String(platform || '').trim(),
        profileLink: String(profileLink || '').trim(),
      }))
      .filter((item) => item.platform || item.profileLink);
  }

  return [];
};

export const isPremiumEnabledFromConfig = (payload: any): boolean => {
  if (!payload || typeof payload !== 'object') return false;
  if (typeof payload.premium_plan_enabled === 'boolean') return payload.premium_plan_enabled;
  if (typeof payload.premiumPlanEnabled === 'boolean') return payload.premiumPlanEnabled;
  if (Array.isArray(payload.enabled_plan_types)) {
    return payload.enabled_plan_types.map(normalizePlanType).includes('premium');
  }
  if (Array.isArray(payload.enabledPlans)) {
    return payload.enabledPlans.map(normalizePlanType).includes('premium');
  }
  return false;
};

export const mapArtistRequestDto = (item: any): ArtistRequest => {
  const artistName =
    String((item as any).artist_name ?? item.artistName ?? item.name ?? 'Unknown').trim() || 'Unknown';
  const handle =
    String((item as any).handle ?? (item as any).handle_suggestion ?? item.handleSuggestion ?? '').trim();
  const email = String((item as any).email ?? (item as any).contact_email ?? item.contactEmail ?? '').trim();
  const phone = String((item as any).phone ?? (item as any).contact_phone ?? item.contactPhone ?? '').trim();
  const createdAt = String((item as any).created_at ?? item.createdAt ?? new Date().toISOString()).trim();

  return {
    id: String(item.id),
    createdAt,
    status: normalizeArtistRequestStatus(item.status),
    source: String(item.source ?? 'artist_access_request'),
    labelId: (item as any).label_id ?? item.labelId ?? null,
    artistName,
    handle,
    email,
    phone,
    socials: normalizeSocials((item as any).socials ?? item.socials),
    aboutMe: String((item as any).about_me ?? item.aboutMe ?? (item as any).pitch ?? '').trim(),
    profilePhotoUrl:
      resolveMediaUrl(
        String(
          (item as any).profile_photo_url ??
            (item as any).profile_photo_path ??
            item.profilePhotoUrl ??
            item.profilePhotoPath ??
            ''
        ).trim() || null
      ) ?? '',
    messageForFans: String(
      (item as any).message_for_fans ?? item.messageForFans ?? (item as any).fan_message ?? ''
    ).trim(),
    requestedPlanType: normalizePlan(
      String((item as any).requested_plan_type ?? item.requestedPlanType ?? 'basic')
    ),
    rejectionComment: String((item as any).rejection_comment ?? item.rejectionComment ?? '').trim(),
  };
};
