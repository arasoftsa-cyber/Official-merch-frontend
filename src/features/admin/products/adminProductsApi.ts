import { apiFetch, apiFetchForm } from '../../../shared/api/http';
import {
  parseAdminArtists,
  parseAdminProductDetailPayload,
  parseAdminProductPhotoUpdateResponse,
  parseAdminProducts,
  parsePendingMerchRequests,
  type Artist,
  type PendingMerchRequest,
  type Product,
} from './adminProductsDtos';
import { normalizeStatus } from '../pages/AdminProductsPage.utils';

export type AdminProductsDataSnapshot = {
  products: Product[];
  artists: Artist[];
  pendingRequests: PendingMerchRequest[];
};

export async function fetchAdminProductsDataSnapshot(): Promise<AdminProductsDataSnapshot> {
  const [productsResult, artistsResult, pendingResult, rejectedResult] = await Promise.allSettled([
    apiFetch('/admin/products', { cache: 'no-store' }),
    apiFetch('/artists', { cache: 'no-store' }),
    apiFetch('/admin/products/onboarding?status=pending', { cache: 'no-store' }),
    apiFetch('/admin/products/onboarding?status=rejected', { cache: 'no-store' }),
  ]);

  if (productsResult.status !== 'fulfilled') {
    throw productsResult.reason;
  }

  const productsPayload = productsResult.value;
  const artistsPayload = artistsResult.status === 'fulfilled' ? artistsResult.value : null;
  const pendingPayload = pendingResult.status === 'fulfilled' ? pendingResult.value : null;
  const rejectedPayload = rejectedResult.status === 'fulfilled' ? rejectedResult.value : null;

  const products = parseAdminProducts(productsPayload);
  const artists = artistsPayload ? parseAdminArtists(artistsPayload) : [];
  const pendingItems = pendingPayload ? parsePendingMerchRequests(pendingPayload) : [];
  const rejectedItems = rejectedPayload ? parsePendingMerchRequests(rejectedPayload) : [];

  const pendingRequests = [...pendingItems, ...rejectedItems]
    .filter((item) => ['pending', 'rejected'].includes(normalizeStatus(item?.status)))
    .sort((left, right) => {
      const leftTs = new Date(String(left.createdAt || 0)).getTime();
      const rightTs = new Date(String(right.createdAt || 0)).getTime();
      return Number.isFinite(rightTs) ? rightTs - (Number.isFinite(leftTs) ? leftTs : 0) : 0;
    });

  return {
    products,
    artists,
    pendingRequests,
  };
}

export async function fetchAdminProductDetail(productId: string): Promise<Product | null> {
  const payload = await apiFetch(`/products/${productId}`);
  return parseAdminProductDetailPayload(payload);
}

export async function patchAdminProduct(
  productId: string,
  body: {
    title: string;
    description: string;
    merch_story: string;
    isActive: boolean;
  }
): Promise<void> {
  await apiFetch(`/admin/products/${productId}`, {
    method: 'PATCH',
    body,
  });
}

export async function replaceAdminProductPhotos(
  productId: string,
  photos: File[]
): Promise<string[]> {
  const fd = new FormData();
  photos.forEach((file) => {
    fd.append('photos', file);
  });
  const photoUpdate = await apiFetchForm(`/admin/products/${productId}/photos`, fd, {
    method: 'PUT',
  });
  return parseAdminProductPhotoUpdateResponse(photoUpdate);
}

export async function approveAdminPendingMerchRequest(
  productId: string,
  listingPhotos: File[]
): Promise<void> {
  const fd = new FormData();
  listingPhotos.forEach((file) => {
    fd.append('listing_photos', file);
  });
  await apiFetchForm(`/admin/products/${productId}/onboarding/approve`, fd, {
    method: 'POST',
  });
}

export async function rejectAdminPendingMerchRequest(
  productId: string,
  rejectionReason: string | null
): Promise<void> {
  await apiFetch(`/admin/products/${productId}/onboarding/reject`, {
    method: 'POST',
    body: {
      rejection_reason: rejectionReason,
    },
  });
}
