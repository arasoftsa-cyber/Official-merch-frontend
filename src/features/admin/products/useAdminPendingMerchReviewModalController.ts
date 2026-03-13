import { useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';

import { resolveMediaUrl } from '../../../shared/utils/media';
import type { FieldErrors, PendingMerchRequest } from '../pages/AdminProductsPage.utils';
import {
  MAX_MARKETPLACE_IMAGES,
  MIN_MARKETPLACE_IMAGES,
  isAllowedMarketplaceImage,
  mapPendingApproveErrorMessage,
  mapPendingRejectErrorMessage,
  normalizeStatus,
  readText,
} from '../pages/AdminProductsPage.utils';

type UseAdminPendingMerchReviewModalControllerInput = {
  loadProductDetail: (productId: string) => Promise<any>;
  approvePendingMerchRequest: (productId: string, files: File[]) => Promise<void>;
  rejectPendingMerchRequest: (productId: string, rejectionReason: string | null) => Promise<void>;
  reload: () => Promise<void>;
};

export function useAdminPendingMerchReviewModalController({
  loadProductDetail,
  approvePendingMerchRequest,
  rejectPendingMerchRequest,
  reload,
}: UseAdminPendingMerchReviewModalControllerInput) {
  const [isPendingOpen, setIsPendingOpen] = useState(false);
  const [pendingModalLoading, setPendingModalLoading] = useState(false);
  const [pendingModalError, setPendingModalError] = useState<string | null>(null);
  const [pendingModalSuccess, setPendingModalSuccess] = useState<string | null>(null);
  const [pendingActionSaving, setPendingActionSaving] = useState(false);
  const [pendingReviewRequest, setPendingReviewRequest] = useState<PendingMerchRequest | null>(null);
  const [pendingRejectionReason, setPendingRejectionReason] = useState('');
  const [pendingMarketplaceFiles, setPendingMarketplaceFiles] = useState<File[]>([]);
  const [pendingFieldErrors, setPendingFieldErrors] = useState<FieldErrors>({});
  const pendingMarketplaceInputRef = useRef<HTMLInputElement | null>(null);

  const resetPendingModalState = () => {
    setPendingModalLoading(false);
    setPendingModalError(null);
    setPendingModalSuccess(null);
    setPendingActionSaving(false);
    setPendingRejectionReason('');
    setPendingMarketplaceFiles([]);
    setPendingFieldErrors({});
    if (pendingMarketplaceInputRef.current) {
      pendingMarketplaceInputRef.current.value = '';
    }
  };

  const closePendingModal = () => {
    setIsPendingOpen(false);
    setPendingReviewRequest(null);
    resetPendingModalState();
  };

  const openPendingModal = async (request: PendingMerchRequest) => {
    setIsPendingOpen(true);
    setPendingReviewRequest(request);
    setPendingRejectionReason(readText(request.rejectionReason || request.rejection_reason));
    resetPendingModalState();
    setPendingRejectionReason(readText(request.rejectionReason || request.rejection_reason));
    setPendingModalLoading(true);
    try {
      const detailProduct = (await loadProductDetail(request.id)) as PendingMerchRequest | null;
      if (detailProduct && typeof detailProduct === 'object') {
        const resolvedRejectionReason = readText(
          request.rejectionReason ||
            request.rejection_reason ||
            detailProduct.rejectionReason ||
            detailProduct.rejection_reason
        );
        setPendingReviewRequest((prev) => ({
          ...(prev || request),
          ...detailProduct,
          id: request.id,
          artistId:
            request.artistId || request.artist_id || detailProduct.artistId || detailProduct.artist_id,
          artistName: request.artistName || request.artistHandle || detailProduct.artistName,
          artistHandle: request.artistHandle || detailProduct.artistHandle,
          status: request.status || detailProduct.status || 'pending',
          rejectionReason:
            request.rejectionReason ||
            request.rejection_reason ||
            detailProduct.rejectionReason ||
            detailProduct.rejection_reason ||
            null,
          rejection_reason:
            request.rejection_reason ||
            request.rejectionReason ||
            detailProduct.rejection_reason ||
            detailProduct.rejectionReason ||
            null,
          skuTypes: Array.isArray(request.skuTypes)
            ? request.skuTypes
            : Array.isArray(request.sku_types)
              ? request.sku_types
              : Array.isArray(detailProduct.skuTypes)
                ? detailProduct.skuTypes
                : [],
          sku_types: Array.isArray(request.sku_types)
            ? request.sku_types
            : Array.isArray(request.skuTypes)
              ? request.skuTypes
              : Array.isArray(detailProduct.sku_types)
                ? detailProduct.sku_types
                : [],
          designImageUrl:
            resolveMediaUrl(
              request.designImageUrl ||
                request.design_image_url ||
                detailProduct.designImageUrl ||
                detailProduct.design_image_url ||
                null
            ) || '',
        }));
        setPendingRejectionReason(resolvedRejectionReason);
      }
    } catch (err: any) {
      setPendingModalError(err?.message ?? 'Failed to load pending merchandise details.');
    } finally {
      setPendingModalLoading(false);
    }
  };

  const validatePendingApprovalFiles = (files: File[]): FieldErrors => {
    const errors: FieldErrors = {};
    if (files.length > MAX_MARKETPLACE_IMAGES) {
      errors.marketplace_images = `You can upload up to ${MAX_MARKETPLACE_IMAGES} marketplace images.`;
      return errors;
    }
    if (files.length < MIN_MARKETPLACE_IMAGES) {
      errors.marketplace_images = `Upload at least ${MIN_MARKETPLACE_IMAGES} marketplace images before approval.`;
      return errors;
    }
    if (files.some((file) => !isAllowedMarketplaceImage(file))) {
      errors.marketplace_images = 'Only JPG and PNG marketplace images are allowed.';
    }
    return errors;
  };

  const onPendingMarketplaceFilesChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setPendingModalError(null);
    setPendingModalSuccess(null);
    if (files.length > MAX_MARKETPLACE_IMAGES) {
      setPendingMarketplaceFiles([]);
      setPendingFieldErrors((prev) => ({
        ...prev,
        marketplace_images: `You can upload up to ${MAX_MARKETPLACE_IMAGES} marketplace images.`,
      }));
      if (pendingMarketplaceInputRef.current) {
        pendingMarketplaceInputRef.current.value = '';
      }
      return;
    }
    setPendingMarketplaceFiles(files);
    const validationErrors = validatePendingApprovalFiles(files);
    setPendingFieldErrors((prev) => ({
      ...prev,
      marketplace_images: validationErrors.marketplace_images || '',
    }));
  };

  const removePendingMarketplaceImage = (index: number) => {
    setPendingModalError(null);
    setPendingModalSuccess(null);
    const nextFiles = pendingMarketplaceFiles.filter((_, fileIndex) => fileIndex !== index);
    setPendingMarketplaceFiles(nextFiles);
    const validationErrors = validatePendingApprovalFiles(nextFiles);
    setPendingFieldErrors((current) => ({
      ...current,
      marketplace_images: validationErrors.marketplace_images || '',
    }));
    if (pendingMarketplaceInputRef.current) {
      pendingMarketplaceInputRef.current.value = '';
    }
  };

  const approvePendingRequest = async () => {
    if (!pendingReviewRequest?.id || pendingActionSaving) return;
    const validationErrors = validatePendingApprovalFiles(pendingMarketplaceFiles);
    setPendingFieldErrors((prev) => ({
      ...prev,
      marketplace_images: validationErrors.marketplace_images || '',
    }));
    if (Object.keys(validationErrors).length > 0) {
      setPendingModalError('Please upload 4 to 6 valid marketplace images (JPG or PNG) before approval.');
      return;
    }

    setPendingActionSaving(true);
    setPendingModalError(null);
    setPendingModalSuccess(null);
    try {
      await approvePendingMerchRequest(pendingReviewRequest.id, pendingMarketplaceFiles);
      setPendingModalSuccess('Merch request approved successfully.');
      await reload();
      closePendingModal();
    } catch (err: any) {
      setPendingModalError(mapPendingApproveErrorMessage(err));
    } finally {
      setPendingActionSaving(false);
    }
  };

  const rejectPendingRequest = async () => {
    if (!pendingReviewRequest?.id || pendingActionSaving) return;
    setPendingActionSaving(true);
    setPendingModalError(null);
    setPendingModalSuccess(null);
    try {
      await rejectPendingMerchRequest(
        pendingReviewRequest.id,
        readText(pendingRejectionReason) || null
      );
      setPendingModalSuccess('Merch request rejected.');
      await reload();
      closePendingModal();
    } catch (err: any) {
      setPendingModalError(mapPendingRejectErrorMessage(err));
    } finally {
      setPendingActionSaving(false);
    }
  };

  const pendingReviewStatus = normalizeStatus(pendingReviewRequest?.status || 'pending') || 'pending';
  const pendingReviewRejectionReason = readText(
    pendingReviewRequest?.rejectionReason || pendingReviewRequest?.rejection_reason
  );
  const pendingReviewMutable = pendingReviewStatus === 'pending';

  const pendingMarketplaceValidationErrors = useMemo(
    () => validatePendingApprovalFiles(pendingMarketplaceFiles),
    [pendingMarketplaceFiles]
  );

  const pendingMarketplaceError =
    readText(pendingFieldErrors.marketplace_images) ||
    readText(pendingMarketplaceValidationErrors.marketplace_images);

  const pendingApproveDisabledReason = pendingModalLoading
    ? 'Loading request details...'
    : pendingActionSaving
      ? 'Approval is in progress...'
      : !pendingReviewMutable
        ? 'Only pending requests can be approved.'
        : pendingMarketplaceError;

  const pendingApproveDisabled = Boolean(pendingApproveDisabledReason);

  const pendingDesignPreview = resolveMediaUrl(
    pendingReviewRequest?.designImageUrl || pendingReviewRequest?.design_image_url || null
  );

  return {
    isPendingOpen,
    pendingModalLoading,
    pendingModalError,
    pendingModalSuccess,
    pendingActionSaving,
    pendingReviewRequest,
    pendingRejectionReason,
    pendingMarketplaceFiles,
    pendingMarketplaceInputRef,
    pendingReviewStatus,
    pendingReviewRejectionReason,
    pendingReviewMutable,
    pendingMarketplaceError,
    pendingApproveDisabledReason,
    pendingApproveDisabled,
    pendingDesignPreview,
    openPendingModal,
    closePendingModal,
    onPendingMarketplaceFilesChange,
    removePendingMarketplaceImage,
    approvePendingRequest,
    rejectPendingRequest,
    setPendingRejectionReason,
  };
}
