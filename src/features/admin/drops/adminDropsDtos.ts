import { createApiContractError, readArrayEnvelope } from '../../../shared/api/contract';
import { resolveMediaUrl } from '../../../shared/utils/media';
import type { DropRow } from '../components/drops/types';

const ADMIN_DROPS_DOMAIN = 'admin.drops';

export const normalizeDrop = (raw: any): DropRow | null => {
  const id = raw?.id;
  const title = raw?.title;
  if (!id || !title) return null;

  return {
    id: String(id),
    handle: raw?.handle ? String(raw.handle) : undefined,
    title: String(title),
    status: String(raw?.status ?? 'draft'),
    artistId: raw?.artistId ?? raw?.artist_id ?? null,
    artistName: raw?.artistName ?? raw?.artist_name ?? null,
    description: raw?.description ?? null,
    heroImageUrl: resolveMediaUrl(
      typeof raw?.heroImageUrl === 'string'
        ? raw.heroImageUrl
        : typeof raw?.coverUrl === 'string'
          ? raw.coverUrl
          : null
    ),
    startsAt: raw?.startsAt ?? raw?.starts_at ?? null,
    endsAt: raw?.endsAt ?? raw?.ends_at ?? null,
    quizJson: raw?.quizJson ?? raw?.quiz_json ?? null,
    mappedProductsCount:
      typeof raw?.mappedProductsCount === 'number'
        ? raw.mappedProductsCount
        : typeof raw?.mapped_products_count === 'number'
          ? raw.mapped_products_count
          : null,
    createdAt: raw?.createdAt ?? raw?.created_at ?? null,
    updatedAt: raw?.updatedAt ?? raw?.updated_at ?? null,
  };
};

export const parseAdminDropItems = (payload: unknown): DropRow[] =>
  readArrayEnvelope(payload, 'items', ADMIN_DROPS_DOMAIN, {
    allowDirectArray: true,
  })
    .map(normalizeDrop)
    .filter((item: DropRow | null): item is DropRow => Boolean(item));

export const parseAdminDropHeroUploadResponse = (payload: unknown): string => {
  const source =
    payload && typeof payload === 'object' && !Array.isArray(payload)
      ? (payload as Record<string, any>)
      : {};
  const uploadedUrl = resolveMediaUrl(
    typeof source.heroImageUrl === 'string'
      ? source.heroImageUrl
      : typeof source.public_url === 'string'
        ? source.public_url
        : null
  );
  if (!uploadedUrl) {
    throw createApiContractError(
      ADMIN_DROPS_DOMAIN,
      'Drop hero upload response is missing heroImageUrl.'
    );
  }
  return uploadedUrl;
};
