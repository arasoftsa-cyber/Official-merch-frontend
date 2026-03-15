import { readArrayEnvelope } from '../../../shared/api/contract';
import { resolveMediaUrl } from '../../../shared/utils/media';
import type { ArtistRequest, ArtistRequestPlanType, ArtistRequestStatus } from './types';

const ARTIST_REQUESTS_DOMAIN = 'admin.artistRequests';

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
  if (Array.isArray(payload.enabled_plan_types)) {
    return payload.enabled_plan_types.map(normalizePlanType).includes('premium');
  }
  return false;
};

export const mapArtistRequestDto = (item: any): ArtistRequest => {
  const artistName =
    String((item as any).artist_name ?? item.artistName ?? 'Unknown').trim() || 'Unknown';
  const handle = String((item as any).handle ?? '').trim();
  const email = String((item as any).email ?? '').trim();
  const phone = String((item as any).phone ?? '').trim();
  const createdAt = String((item as any).created_at ?? item.createdAt ?? '').trim();

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
    socials: normalizeSocials((item as any).socials),
    aboutMe: String((item as any).about_me ?? item.aboutMe ?? '').trim(),
    profilePhotoUrl:
      resolveMediaUrl(
        String(
          (item as any).profile_photo_url ??
            (item as any).profile_photo_path ??
            item.profilePhotoUrl ??
            ''
        ).trim() || null
      ) ?? '',
    messageForFans: String((item as any).message_for_fans ?? item.messageForFans ?? '').trim(),
    requestedPlanType: normalizePlan(
      String((item as any).requested_plan_type ?? item.requestedPlanType ?? 'basic')
    ),
    rejectionComment: String((item as any).rejection_comment ?? item.rejectionComment ?? '').trim(),
  };
};

export const parseAdminArtistRequestsResponse = (
  payload: unknown,
  fallbackPage: number
): { items: ArtistRequest[]; total: number; page: number } => {
  const items = readArrayEnvelope(payload, 'items', ARTIST_REQUESTS_DOMAIN).map(mapArtistRequestDto);
  const source = (payload && typeof payload === 'object' ? payload : {}) as Record<string, any>;
  const total = typeof source.total === 'number' ? source.total : items.length;
  const page = Number(source.page) || fallbackPage;
  return { items, total, page };
};
