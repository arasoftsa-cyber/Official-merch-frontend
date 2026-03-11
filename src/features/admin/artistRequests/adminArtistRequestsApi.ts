import { apiFetch } from '../../../shared/api/http';
import { resolveMediaUrl } from '../../../shared/utils/media';
import {
  ARTIST_REQUESTS_ENDPOINT,
  ARTIST_REQUESTS_LIMIT,
  type ArtistRequest,
  type SaveAction,
  type StatusOption,
} from './types';

export const formatStatus = (status?: string) => (status ? status.toUpperCase() : 'PENDING');

export const normalizePlanType = (value: unknown) => String(value ?? '').trim().toLowerCase();

export const normalizePlan = (value: string) => {
  const s = (value || '').toLowerCase().trim();
  if (s === 'basic') return 'basic';
  if (s === 'advanced') return 'advanced';
  if (s === 'premium') return 'premium';
  return s;
};

const normalizeSocials = (value: any) => {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value
      .map((item) => ({
        platform: String(item?.platform ?? item?.name ?? '').trim(),
        profileLink: String(item?.profileLink ?? item?.url ?? item?.link ?? item?.value ?? '').trim(),
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

const normalizeArtistRequest = (item: any): ArtistRequest => {
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
    status: String(item.status ?? 'pending'),
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
    requestedPlanType: normalizePlanType((item as any).requested_plan_type ?? item.requestedPlanType ?? 'basic'),
    rejectionComment: String((item as any).rejection_comment ?? item.rejectionComment ?? '').trim(),
  };
};

export async function fetchAdminArtistRequests(params: {
  page: number;
  statusFilter: StatusOption;
}): Promise<{ items: ArtistRequest[]; total: number; page: number }> {
  const searchParams = new URLSearchParams();
  searchParams.set('pageSize', ARTIST_REQUESTS_LIMIT.toString());
  searchParams.set('page', params.page.toString());
  if (params.statusFilter) {
    searchParams.set('status', params.statusFilter);
  }

  const payload = await apiFetch(`${ARTIST_REQUESTS_ENDPOINT}?${searchParams.toString()}`);

  let items: any[] = [];
  let totalCount = 0;
  let pageFromPayload = params.page;

  if (Array.isArray(payload)) {
    items = payload;
    totalCount = payload.length;
  } else {
    items = payload?.items ?? [];
    totalCount = payload?.total ?? items.length;
    pageFromPayload = Number(payload?.page) || params.page;
  }

  return {
    items: items.map(normalizeArtistRequest),
    total: totalCount,
    page: pageFromPayload,
  };
}

export async function fetchPremiumPlanEnabled(): Promise<boolean> {
  const payload = await apiFetch('/config');
  return isPremiumEnabledFromConfig(payload);
}

export async function saveAdminArtistRequestDecision(input: {
  requestId: string;
  action: SaveAction;
  rejectComment?: string;
  finalPlanType?: string;
  paymentMode?: 'cash' | 'online' | '';
  transactionId?: string;
  approvalPassword?: string;
}): Promise<void> {
  const normalizedFinalPlanType = normalizePlan(input.finalPlanType || '');
  const approvalBody = {
    final_plan_type: normalizedFinalPlanType,
    payment_mode: normalizedFinalPlanType === 'basic' ? 'NA' : input.paymentMode,
    transaction_id: normalizedFinalPlanType === 'basic' ? 'NA' : (input.transactionId || '').trim(),
    password: (input.approvalPassword || '').trim(),
  };

  await apiFetch(`${ARTIST_REQUESTS_ENDPOINT}/${input.requestId}/${input.action}`, {
    method: 'POST',
    ...(input.action === 'reject' ? { body: { comment: (input.rejectComment || '').trim() } } : { body: approvalBody }),
  });
}

export { ARTIST_REQUESTS_ENDPOINT, ARTIST_REQUESTS_LIMIT };
