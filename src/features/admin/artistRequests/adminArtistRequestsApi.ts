import { apiFetch } from '../../../shared/api/http';
import {
  ARTIST_REQUESTS_ENDPOINT,
  ARTIST_REQUESTS_LIMIT,
  type ArtistRequest,
  type ArtistRequestStatus,
  type SaveAction,
  type StatusOption,
} from './types';
import {
  isPremiumEnabledFromConfig,
  mapArtistRequestDto,
  normalizePlan,
} from './adminArtistRequestDtos';

export const formatStatus = (status?: ArtistRequestStatus) => (status ?? 'pending').toUpperCase();

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
    items: items.map(mapArtistRequestDto),
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
export { normalizePlan } from './adminArtistRequestDtos';
