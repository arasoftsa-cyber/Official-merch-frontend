import { resolveMediaUrl } from '../../../shared/utils/media';
import { formatDateTime } from '../../../shared/utils/formatting';

export type Artist = {
  id: string;
  handle?: string;
  name?: string;
};

export type Product = {
  id: string;
  productId?: string;
  title?: string;
  name?: string;
  description?: string;
  merchType?: string;
  merch_type?: string;
  merch_story?: string;
  merchStory?: string;
  artistId?: string;
  artist_id?: string;
  isActive?: boolean;
  is_active?: boolean;
  active?: boolean;
  status?: string;
  primaryPhotoUrl?: string;
  listingPhotoUrl?: string;
  listingPhotoUrls?: string[];
  photoUrls?: string[];
  photos?: string[];
  createdAt?: string;
  created_at?: string;
  rejectionReason?: string | null;
  rejection_reason?: string | null;
  skuTypes?: string[];
  sku_types?: string[];
  designImageUrl?: string;
  design_image_url?: string;
  artistName?: string;
  artistHandle?: string;
};

export type ProductsTab = 'catalog' | 'pending';

export type PendingMerchRequest = Product & {
  status: string;
};

export type FieldErrors = Record<string, string>;
export type ProductEditSnapshot = {
  title: string;
  description: string;
  isActive: boolean;
};

export const MAX_LISTING_PHOTOS = 4;
export const LISTING_PHOTO_ACCEPT = 'image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp';
export const ALLOWED_LISTING_PHOTO_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
export const MIN_MARKETPLACE_IMAGES = 4;
export const MAX_MARKETPLACE_IMAGES = 6;
export const MARKETPLACE_IMAGE_ACCEPT = 'image/jpeg,image/png,.jpg,.jpeg,.png';
export const ALLOWED_MARKETPLACE_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png']);

export const readText = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

export const shouldLogAdminEditModalDebug = (): boolean => {
  if (!import.meta.env.DEV || typeof window === 'undefined') return false;
  try {
    if (window.location.search.includes('debugAdminEditModal=1')) return true;
    return window.localStorage.getItem('om_debug_admin_edit_modal') === '1';
  } catch {
    return false;
  }
};

export const logAdminEditModalDebug = (event: string, payload: Record<string, unknown> = {}) => {
  if (!shouldLogAdminEditModalDebug()) return;
  // eslint-disable-next-line no-console
  console.info(`[admin-edit-modal] ${event}`, payload);
};

export const firstText = (source: Record<string, any>, keys: string[]): string => {
  for (const key of keys) {
    const value = readText(source?.[key]);
    if (value) return value;
  }
  return '';
};

export const makeEditSnapshot = (values: {
  title: string;
  description: string;
  isActive: boolean;
}): ProductEditSnapshot => ({
  title: values.title.trim(),
  description: values.description.trim(),
  isActive: Boolean(values.isActive),
});

export const hasSnapshotChanges = (
  current: ProductEditSnapshot,
  baseline: ProductEditSnapshot | null
): boolean =>
  Boolean(
    baseline &&
      (current.title !== baseline.title ||
        current.description !== baseline.description ||
        current.isActive !== baseline.isActive)
  );

export const snapshotFromProduct = (product: Product | null | undefined): ProductEditSnapshot =>
  makeEditSnapshot({
    title: firstText((product || {}) as Record<string, any>, ['title', 'name']),
    description: firstText((product || {}) as Record<string, any>, [
      'merch_story',
      'merchStory',
      'description',
    ]),
    isActive: Boolean(product?.isActive ?? product?.is_active ?? product?.active),
  });

export const isAllowedListingPhoto = (file: File): boolean => {
  const mimeType = readText(file.type).toLowerCase();
  if (mimeType && ALLOWED_LISTING_PHOTO_MIME_TYPES.has(mimeType)) return true;
  return /\.(png|jpe?g|webp)$/i.test(readText(file.name));
};

export const isAllowedMarketplaceImage = (file: File): boolean => {
  const mimeType = readText(file.type).toLowerCase();
  if (mimeType && ALLOWED_MARKETPLACE_IMAGE_MIME_TYPES.has(mimeType)) return true;
  return /\.(png|jpe?g)$/i.test(readText(file.name));
};

export const normalizeStatus = (value: unknown): string => readText(value).toLowerCase();
export const resolveProductId = (product: Product | null | undefined): string =>
  readText(product?.id || product?.productId);

export const readPendingSkuTypes = (request: PendingMerchRequest): string[] => {
  const raw = Array.isArray(request?.skuTypes)
    ? request.skuTypes
    : Array.isArray(request?.sku_types)
      ? request.sku_types
      : [];
  return raw
    .map((entry) => readText(entry))
    .filter(Boolean);
};

export const resolvePendingSubmittedAt = (request: PendingMerchRequest): string => {
  const raw = request?.createdAt ?? request?.created_at ?? null;
  if (!raw) return '-';
  return formatDateTime(raw, { hour12: false });
};

export const mapEditSaveErrorMessage = (err: any): string => {
  const raw = readText(err?.message).toLowerCase();
  const details = Array.isArray(err?.details) ? err.details : [];
  const firstDetailMessage = readText(details[0]?.message).toLowerCase();
  const combined = `${raw} ${firstDetailMessage}`;

  if (raw === 'no_fields') return 'No changes to save yet.';
  if (combined.includes('exactly 4 photos')) {
    return 'Please select exactly 4 product images to replace all photos.';
  }
  if (
    combined.includes('invalid') &&
    combined.includes('photo')
  ) {
    return 'Please select valid product images (PNG, JPG, or WEBP).';
  }
  if (raw.startsWith('http_5') || raw === 'internal_server_error') {
    return "We couldn't update the product right now. Please try again.";
  }
  if (raw === 'failed to fetch') {
    return "We couldn't update the product right now. Please check your connection and try again.";
  }
  if (raw === 'validation') {
    return readText(details[0]?.message) || 'Please review the highlighted fields and try again.';
  }
  return "We couldn't update the product right now. Please try again.";
};

export const mapPendingApproveErrorMessage = (err: any): string => {
  const raw = readText(err?.message).toLowerCase();
  const details = Array.isArray(err?.details) ? err.details : [];
  const firstDetailMessage = readText(details[0]?.message).toLowerCase();
  const combined = `${raw} ${firstDetailMessage}`;

  if (combined.includes('at least 4') || combined.includes('4-6') || combined.includes('exactly 4')) {
    return 'Upload at least 4 marketplace images before approval.';
  }
  if (combined.includes('at most 6') || combined.includes('maximum 6') || combined.includes('up to 6')) {
    return 'You can upload up to 6 marketplace images.';
  }
  if (
    combined.includes('jpg') ||
    combined.includes('jpeg') ||
    combined.includes('png') ||
    combined.includes('marketplace images')
  ) {
    return 'Only JPG and PNG marketplace images are allowed.';
  }
  if (raw === 'validation') {
    return 'Please upload 4 to 6 valid marketplace images (JPG or PNG) before approval.';
  }
  if (raw === 'invalid_status_transition') {
    return 'Only pending requests can be approved.';
  }
  if (raw.startsWith('http_5') || raw === 'internal_server_error' || raw === 'failed to fetch') {
    return "We couldn't approve this merch request right now. Please try again.";
  }
  return "We couldn't approve this merch request right now. Please try again.";
};

export const mapPendingRejectErrorMessage = (err: any): string => {
  const raw = readText(err?.message).toLowerCase();
  if (raw === 'invalid_status_transition') {
    return 'Only pending requests can be rejected.';
  }
  if (raw.startsWith('http_5') || raw === 'internal_server_error' || raw === 'failed to fetch') {
    return "We couldn't reject this merch request right now. Please try again.";
  }
  return "We couldn't reject this merch request right now. Please try again.";
};

export const extractListingPhotoUrls = (product: Product | null | undefined): string[] => {
  if (!product) return [];
  const candidates = [
    ...(Array.isArray(product.listingPhotoUrls) ? product.listingPhotoUrls : []),
    ...(Array.isArray(product.photoUrls) ? product.photoUrls : []),
    ...(Array.isArray(product.photos) ? product.photos : []),
    typeof product.listingPhotoUrl === 'string' ? product.listingPhotoUrl : '',
    typeof product.primaryPhotoUrl === 'string' ? product.primaryPhotoUrl : '',
  ]
    .map((entry) => resolveMediaUrl(typeof entry === 'string' ? entry : null))
    .filter((entry): entry is string => Boolean(entry));
  return Array.from(new Set(candidates)).slice(0, 4);
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

export const normalizeProductItem = (item: any): Product | null => {
  if (!item || typeof item !== 'object') return null;
  const normalizedId = readText(item.id ?? item.productId ?? item.product_id);
  if (!normalizedId) return null;

  return {
    ...(item as Product),
    id: normalizedId,
    productId: readText(item.productId ?? item.product_id ?? item.id) || normalizedId,
    artistId: readText(item.artistId ?? item.artist_id),
    artist_id: readText(item.artist_id ?? item.artistId),
  };
};

export const normalizeArtistItem = (item: any): Artist | null => {
  if (!item || typeof item !== 'object') return null;
  const normalizedId = readText(item.id ?? item.artistId ?? item.artist_id);
  if (!normalizedId) return null;
  return {
    id: normalizedId,
    handle: readText(item.handle),
    name: readText(item.name),
  };
};

export const normalizePendingRequestItem = (item: any): PendingMerchRequest | null => {
  const normalized = normalizeProductItem(item);
  if (!normalized) return null;
  const status = normalizeStatus(item?.status || 'pending') || 'pending';
  return {
    ...(normalized as PendingMerchRequest),
    status,
  };
};
