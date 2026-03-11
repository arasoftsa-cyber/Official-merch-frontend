import { apiFetch, apiFetchForm } from '../../../shared/api/http';
import type {
  ArtistOption,
  DropLifecycleAction,
  DropRow,
  ProductOption,
} from '../components/drops/types';

const ADMIN_DROPS_BASE = '/api/admin/drops';

type AdminFetchResult<T> = {
  ok: boolean;
  status: number;
  data?: T;
  errText?: string;
};

export type AdminDropsSnapshot = {
  rows: DropRow[];
  artists: ArtistOption[];
  products: ProductOption[];
  mappedCountByDropId: Record<string, number>;
};

export const MAX_HERO_IMAGE_BYTES = 5 * 1024 * 1024;
export const ALLOWED_HERO_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const normalizeAdminFetchError = (rawMessage: unknown, statusCode: number) => {
  const message = String(rawMessage ?? '').trim();
  if (!message) {
    return statusCode > 0 ? `HTTP_${statusCode}` : 'Request failed';
  }

  const looksLikeHtml =
    /<!doctype html/i.test(message) ||
    /<html[\s>]/i.test(message) ||
    /<\/?[a-z][\s\S]*>/i.test(message);
  const isRouteMiss = /\bcannot\s+(get|post|put|patch|delete)\b/i.test(message);
  if (looksLikeHtml || isRouteMiss) {
    return statusCode === 404
      ? 'Admin drops endpoint is unavailable.'
      : `Unexpected server response (HTTP_${statusCode || 0})`;
  }

  return message;
};

async function adminFetch<T>(path: string, init?: RequestInit): Promise<AdminFetchResult<T>> {
  try {
    const data = await apiFetch(path, init);
    return { ok: true, status: 200, data: data as T };
  } catch (err: any) {
    const status = Number(err?.status ?? 0);
    return {
      ok: false,
      status,
      errText: normalizeAdminFetchError(err?.message ?? 'Request failed', status),
    };
  }
}

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
    heroImageUrl: raw?.heroImageUrl ?? raw?.hero_image_url ?? null,
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

const normalizeArtist = (artist: any): ArtistOption | null => {
  const id = artist?.id;
  if (!id) return null;
  return {
    id: String(id),
    name: String(artist?.name ?? artist?.handle ?? id),
  };
};

const normalizeProduct = (product: any): ProductOption | null => {
  const id = product?.id;
  if (!id) return null;
  return {
    id: String(id),
    title: String(product?.title ?? id),
    artistId: product?.artistId ?? product?.artist_id ?? undefined,
  };
};

export async function fetchAdminDropsSnapshot(): Promise<AdminDropsSnapshot> {
  const [dropsResult, artistsPayload, productsPayload] = await Promise.all([
    adminFetch<any>(ADMIN_DROPS_BASE),
    apiFetch('/api/artists'),
    apiFetch('/api/admin/products').catch(() => ({ items: [] })),
  ]);

  if (!dropsResult.ok) {
    throw new Error(dropsResult.errText ?? `HTTP_${dropsResult.status}`);
  }

  const dropsPayload = dropsResult.data;
  const dropItems = Array.isArray(dropsPayload?.items)
    ? dropsPayload.items
    : Array.isArray(dropsPayload)
      ? dropsPayload
      : [];
  const artistItems = Array.isArray(artistsPayload?.artists)
    ? artistsPayload.artists
    : Array.isArray(artistsPayload?.items)
      ? artistsPayload.items
      : [];
  const productItems = Array.isArray(productsPayload?.items)
    ? productsPayload.items
    : Array.isArray(productsPayload)
      ? productsPayload
      : [];

  const artists = artistItems
    .map(normalizeArtist)
    .filter((item: ArtistOption | null): item is ArtistOption => Boolean(item));
  const products = productItems
    .map(normalizeProduct)
    .filter((item: ProductOption | null): item is ProductOption => Boolean(item));

  const artistNameById = new Map(artists.map((artist) => [artist.id, artist.name]));
  const rows = dropItems
    .map(normalizeDrop)
    .filter((item: DropRow | null): item is DropRow => Boolean(item))
    .map((drop) => ({
      ...drop,
      artistName: drop.artistName ?? (drop.artistId ? artistNameById.get(drop.artistId) : null) ?? undefined,
    }));

  const mappedCountByDropId: Record<string, number> = {};
  rows.forEach((row) => {
    if (typeof row.mappedProductsCount === 'number') {
      mappedCountByDropId[row.id] = row.mappedProductsCount;
    }
  });

  return {
    rows,
    artists,
    products,
    mappedCountByDropId,
  };
}

export async function createAdminDrop(title: string, artistId: string): Promise<DropRow | null> {
  const createBody = {
    title,
    artistId,
    artist_id: artistId,
  };

  const createResult = await adminFetch<any>(ADMIN_DROPS_BASE, {
    method: 'POST',
    body: JSON.stringify(createBody) as any,
  });

  if (!createResult.ok) {
    throw new Error(createResult.errText ?? `HTTP_${createResult.status}`);
  }

  return normalizeDrop(createResult.data?.drop ?? createResult.data);
}

export async function runAdminDropLifecycle(dropKey: string, action: DropLifecycleAction): Promise<void> {
  const lifecycleResult = await adminFetch(
    `${ADMIN_DROPS_BASE}/${encodeURIComponent(dropKey)}/${action}`,
    {
      method: 'POST',
    }
  );

  if (!lifecycleResult.ok) {
    throw new Error(lifecycleResult.errText ?? `HTTP_${lifecycleResult.status}`);
  }
}

export async function fetchAdminDropProductIds(dropId: string): Promise<string[]> {
  const productResult = await adminFetch<any>(`${ADMIN_DROPS_BASE}/${encodeURIComponent(dropId)}/products`);
  if (!productResult.ok) {
    throw Object.assign(new Error(productResult.errText ?? `HTTP_${productResult.status}`), {
      status: productResult.status,
    });
  }

  return Array.isArray(productResult.data?.product_ids)
    ? productResult.data.product_ids
        .map((value: any) => String(value || '').trim())
        .filter(Boolean)
    : [];
}

export async function uploadAdminDropHeroImage(dropId: string, file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);

  const payload = await apiFetchForm(
    `${ADMIN_DROPS_BASE}/${encodeURIComponent(dropId)}/hero-image`,
    formData,
    { method: 'POST' }
  );

  const uploadedUrl = String(
    payload?.heroImageUrl ??
      payload?.public_url ??
      payload?.publicUrl ??
      payload?.drop?.heroImageUrl ??
      payload?.drop?.hero_image_url ??
      ''
  ).trim();

  if (!uploadedUrl) {
    throw new Error('Upload succeeded but no hero image URL was returned.');
  }

  return uploadedUrl;
}

export async function patchAdminDropDetails(
  dropId: string,
  body: {
    title: string;
    handle?: string;
    description: string | null;
    hero_image_url: string | null;
    starts_at: string | null;
    ends_at: string | null;
    quiz_json: any;
  }
): Promise<void> {
  const detailsResult = await adminFetch(`${ADMIN_DROPS_BASE}/${encodeURIComponent(dropId)}`, {
    method: 'PATCH',
    body: JSON.stringify(body) as any,
  });

  if (!detailsResult.ok) {
    throw Object.assign(new Error(detailsResult.errText ?? `HTTP_${detailsResult.status}`), {
      status: detailsResult.status,
    });
  }
}

export async function replaceAdminDropProducts(dropId: string, productIds: string[]): Promise<void> {
  const mappingResult = await adminFetch(`${ADMIN_DROPS_BASE}/${encodeURIComponent(dropId)}/products`, {
    method: 'PUT',
    body: JSON.stringify({ product_ids: productIds }) as any,
  });

  if (!mappingResult.ok) {
    throw Object.assign(new Error(mappingResult.errText ?? `HTTP_${mappingResult.status}`), {
      status: mappingResult.status,
    });
  }
}
