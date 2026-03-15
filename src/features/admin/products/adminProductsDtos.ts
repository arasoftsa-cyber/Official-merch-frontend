import { resolveMediaUrl } from '../../../shared/utils/media';

export type Artist = {
  id: string;
  handle: string;
  name: string;
};

export type Product = {
  id: string;
  productId: string;
  title: string;
  name: string;
  description: string;
  merchType: string;
  merchStory: string;
  artistId: string;
  isActive: boolean;
  status: string;
  primaryPhotoUrl: string;
  listingPhotoUrl: string;
  listingPhotoUrls: string[];
  createdAt: string;
  rejectionReason: string | null;
  skuTypes: string[];
  designImageUrl: string;
  artistName: string;
  artistHandle: string;
};

export type PendingMerchRequest = Product & {
  status: 'pending' | 'rejected' | 'approved' | 'unknown';
};

const readText = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const normalizeStatus = (value: unknown): PendingMerchRequest['status'] => {
  const normalized = readText(value).toLowerCase();
  if (normalized === 'pending' || normalized === 'rejected' || normalized === 'approved') {
    return normalized;
  }
  return 'unknown';
};

const readStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => readText(entry)).filter(Boolean);
};

const normalizeListingPhotoUrls = (item: any): string[] => {
  const candidates = [
    ...(Array.isArray(item?.listingPhotoUrls) ? item.listingPhotoUrls : []),
    ...(Array.isArray(item?.listing_photo_urls) ? item.listing_photo_urls : []),
    ...(Array.isArray(item?.photoUrls) ? item.photoUrls : []),
    ...(Array.isArray(item?.photos) ? item.photos : []),
    typeof item?.listingPhotoUrl === 'string' ? item.listingPhotoUrl : '',
    typeof item?.listing_photo_url === 'string' ? item.listing_photo_url : '',
    typeof item?.primaryPhotoUrl === 'string' ? item.primaryPhotoUrl : '',
    typeof item?.primary_photo_url === 'string' ? item.primary_photo_url : '',
  ]
    .map((entry) => resolveMediaUrl(typeof entry === 'string' ? entry : null))
    .filter((entry): entry is string => Boolean(entry));
  return Array.from(new Set(candidates));
};

export const extractItems = (payload: any, keys: string[]) => {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];

  const keySet = Array.from(new Set([...keys, 'results']));
  for (const key of keySet) {
    const candidate = payload?.[key];
    if (Array.isArray(candidate)) return candidate;
    if (candidate && typeof candidate === 'object') {
      for (const nestedKey of keySet) {
        const nestedCandidate = (candidate as any)?.[nestedKey];
        if (Array.isArray(nestedCandidate)) return nestedCandidate;
      }
    }
  }
  return [];
};

export const mapAdminArtistDto = (item: any): Artist | null => {
  if (!item || typeof item !== 'object') return null;
  const id = readText(item?.id ?? item?.artistId ?? item?.artist_id);
  if (!id) return null;

  return {
    id,
    handle: readText(item?.handle),
    name: readText(item?.name),
  };
};

export const mapAdminProductDto = (item: any): Product | null => {
  if (!item || typeof item !== 'object') return null;
  const id = readText(item?.id ?? item?.productId ?? item?.product_id);
  if (!id) return null;

  const listingPhotoUrls = normalizeListingPhotoUrls(item);

  return {
    id,
    productId: readText(item?.productId ?? item?.product_id ?? item?.id) || id,
    title: readText(item?.title),
    name: readText(item?.name),
    description: readText(item?.description),
    merchType: readText(item?.merchType ?? item?.merch_type),
    merchStory: readText(item?.merchStory ?? item?.merch_story ?? item?.description),
    artistId: readText(item?.artistId ?? item?.artist_id),
    isActive: Boolean(item?.isActive ?? item?.is_active ?? item?.active),
    status: readText(item?.status).toLowerCase(),
    primaryPhotoUrl:
      resolveMediaUrl(
        readText(item?.primaryPhotoUrl ?? item?.primary_photo_url) || null
      ) ?? '',
    listingPhotoUrl: listingPhotoUrls[0] ?? '',
    listingPhotoUrls: listingPhotoUrls.slice(0, 4),
    createdAt: readText(item?.createdAt ?? item?.created_at),
    rejectionReason: readText(item?.rejectionReason ?? item?.rejection_reason) || null,
    skuTypes: readStringArray(item?.skuTypes ?? item?.sku_types),
    designImageUrl:
      resolveMediaUrl(
        readText(item?.designImageUrl ?? item?.design_image_url) || null
      ) ?? '',
    artistName: readText(item?.artistName),
    artistHandle: readText(item?.artistHandle),
  };
};

export const mapPendingMerchRequestDto = (item: any): PendingMerchRequest | null => {
  const product = mapAdminProductDto(item);
  if (!product) return null;

  return {
    ...product,
    status: normalizeStatus(item?.status),
  };
};
