import { useCallback, useEffect, useState } from 'react';
import type { Artist, PendingMerchRequest, Product } from '../pages/AdminProductsPage.utils';
import {
  approveAdminPendingMerchRequest,
  fetchAdminProductDetail,
  fetchAdminProductsDataSnapshot,
  patchAdminProduct,
  rejectAdminPendingMerchRequest,
  replaceAdminProductPhotos,
} from './adminProductsApi';

type SaveProductEditsInput = {
  productId: string;
  shouldPatchProduct: boolean;
  patchBody: {
    title: string;
    description: string;
    merch_story: string;
    isActive: boolean;
  };
  shouldUploadPhotos: boolean;
  photos: File[];
};

export function useAdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [pendingRequests, setPendingRequests] = useState<PendingMerchRequest[]>([]);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const snapshot = await fetchAdminProductsDataSnapshot();
      setProducts(snapshot.products);
      setArtists(snapshot.artists);
      setPendingRequests(snapshot.pendingRequests);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load admin products');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const loadProductDetail = useCallback(async (productId: string) => {
    return fetchAdminProductDetail(productId);
  }, []);

  const saveProductEdits = useCallback(
    async (input: SaveProductEditsInput) => {
      const { productId, shouldPatchProduct, patchBody, shouldUploadPhotos, photos } = input;
      if (shouldPatchProduct) {
        await patchAdminProduct(productId, patchBody);
      }

      if (shouldUploadPhotos) {
        const latestListingPhotoUrls = await replaceAdminProductPhotos(productId, photos);
        return { latestListingPhotoUrls };
      }

      return { latestListingPhotoUrls: [] as string[] };
    },
    []
  );

  const approvePendingMerchRequest = useCallback(async (productId: string, files: File[]) => {
    await approveAdminPendingMerchRequest(productId, files);
  }, []);

  const rejectPendingMerchRequest = useCallback(
    async (productId: string, rejectionReason: string | null) => {
      await rejectAdminPendingMerchRequest(productId, rejectionReason);
    },
    []
  );

  return {
    products,
    pendingRequests,
    artists,
    loading,
    error,
    reload,
    loadProductDetail,
    saveProductEdits,
    approvePendingMerchRequest,
    rejectPendingMerchRequest,
  };
}
