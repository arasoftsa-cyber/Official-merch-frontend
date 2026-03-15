import { apiFetch, apiFetchForm } from '../../../shared/api/http';
import { readArrayEnvelope, readObjectEnvelope } from '../../../shared/api/contract';
import type {
  ArtistOption,
  DropLifecycleAction,
  DropRow,
  ProductOption,
} from '../components/drops/types';
import {
  normalizeDrop,
  parseAdminDropHeroUploadResponse,
  parseAdminDropItems,
} from './adminDropsDtos';

const ADMIN_DROPS_BASE = '/api/admin/drops';
const ADMIN_DROPS_DOMAIN = 'admin.drops';

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
  const dropItems = parseAdminDropItems(dropsPayload);
  const artistItems = readArrayEnvelope(artistsPayload, 'items', 'admin.drops.artists');
  const productItems = readArrayEnvelope(productsPayload, 'items', 'admin.drops.products', {
    allowDirectArray: true,
  });

  const artists = artistItems
    .map(normalizeArtist)
    .filter((item: ArtistOption | null): item is ArtistOption => Boolean(item));
  const products = productItems
    .map(normalizeProduct)
    .filter((item: ProductOption | null): item is ProductOption => Boolean(item));

  const artistNameById = new Map(artists.map((artist) => [artist.id, artist.name]));
  const rows = dropItems
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
  };

  const createResult = await adminFetch<any>(ADMIN_DROPS_BASE, {
    method: 'POST',
    body: JSON.stringify(createBody) as any,
  });

  if (!createResult.ok) {
    throw new Error(createResult.errText ?? `HTTP_${createResult.status}`);
  }

  return normalizeDrop(readObjectEnvelope(createResult.data, 'drop', ADMIN_DROPS_DOMAIN, { allowDirect: false }));
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
  return parseAdminDropHeroUploadResponse(payload);
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
