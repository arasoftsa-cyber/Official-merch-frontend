import { resolveMediaUrl } from '../../../shared/utils/media';
import { formatDateTime } from '../../../shared/utils/formatting';
import type { Artist, PendingMerchRequest, Product } from '../products/adminProductsDtos';

export type { Artist, PendingMerchRequest, Product } from '../products/adminProductsDtos';

export type ProductsTab = 'catalog' | 'pending';

export type PendingMerchReviewDetails = {
  artistName: string;
  designPreview: string | null;
  status: string;
  rejectionReason: string;
  isMutable: boolean;
};

export type FieldErrors = Record<string, string>;
export type ProductEditSnapshot = {
  title: string;
  description: string;
  isActive: boolean;
};

export type ProductEditFormValues = {
  artistId: string;
  title: string;
  description: string;
  isActive: boolean;
  listingPhotoUrls: string[];
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
    description: firstText((product || {}) as Record<string, any>, ['merchStory', 'description']),
    isActive: Boolean(product?.isActive),
  });

export const deriveProductEditFormValues = (
  product: Product | null | undefined
): ProductEditFormValues => ({
  artistId: readText(product?.artistId),
  title: firstText((product || {}) as Record<string, any>, ['title', 'name']),
  description: firstText((product || {}) as Record<string, any>, ['merchStory', 'description']),
  isActive: Boolean(product?.isActive),
  listingPhotoUrls: extractListingPhotoUrls(product),
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

export const buildArtistLabelById = (artists: Artist[]): Record<string, string> => {
  const map: Record<string, string> = {};
  artists.forEach((artist) => {
    const label = artist?.name || artist?.handle || artist?.id;
    map[artist.id] = label;
  });
  return map;
};

export const resolvePendingReviewArtistName = (
  request: PendingMerchRequest | null | undefined,
  artistLabelById: Record<string, string>
): string => {
  const artistId = readText(request?.artistId);
  return (
    readText(request?.artistName) ||
    readText(request?.artistHandle) ||
    artistLabelById[artistId] ||
    'Unknown Artist'
  );
};

export const mergePendingReviewRequest = (
  request: PendingMerchRequest,
  detailProduct: PendingMerchRequest
): PendingMerchRequest => ({
  ...request,
  ...detailProduct,
  id: request.id,
  artistId: request.artistId || detailProduct.artistId,
  artistName: request.artistName || request.artistHandle || detailProduct.artistName,
  artistHandle: request.artistHandle || detailProduct.artistHandle,
  status:
    request.status === 'unknown'
      ? detailProduct.status
      : request.status || detailProduct.status || 'pending',
  rejectionReason: request.rejectionReason || detailProduct.rejectionReason || null,
  skuTypes: Array.isArray(request.skuTypes) ? request.skuTypes : detailProduct.skuTypes,
  designImageUrl:
    resolveMediaUrl(request.designImageUrl || detailProduct.designImageUrl || null) || '',
});

export const derivePendingMerchReviewDetails = (
  request: PendingMerchRequest | null | undefined,
  artistLabelById: Record<string, string>
): PendingMerchReviewDetails => {
  const status = normalizeStatus(request?.status || 'pending') || 'pending';
  return {
    artistName: resolvePendingReviewArtistName(request, artistLabelById),
    designPreview: resolveMediaUrl(request?.designImageUrl || null),
    status,
    rejectionReason: readText(request?.rejectionReason),
    isMutable: status === 'pending',
  };
};

export const readPendingSkuTypes = (request: PendingMerchRequest): string[] =>
  (Array.isArray(request?.skuTypes) ? request.skuTypes : [])
    .map((entry) => readText(entry))
    .filter(Boolean);

export const resolvePendingSubmittedAt = (request: PendingMerchRequest): string => {
  const raw = request?.createdAt ?? null;
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
  if (combined.includes('invalid') && combined.includes('photo')) {
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
    typeof product.listingPhotoUrl === 'string' ? product.listingPhotoUrl : '',
    typeof product.primaryPhotoUrl === 'string' ? product.primaryPhotoUrl : '',
  ]
    .map((entry) => resolveMediaUrl(typeof entry === 'string' ? entry : null))
    .filter((entry): entry is string => Boolean(entry));
  return Array.from(new Set(candidates)).slice(0, 4);
};
