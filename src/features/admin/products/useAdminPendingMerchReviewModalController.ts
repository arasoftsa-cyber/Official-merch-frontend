import { useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';

import { resolveMediaUrl } from '../../../shared/utils/media';
import type { FieldErrors, PendingMerchRequest } from '../pages/AdminProductsPage.utils';
import {
  MAX_MARKETPLACE_IMAGES,
  MIN_MARKETPLACE_IMAGES,
  isAllowedMarketplaceImage,
  mergePendingReviewRequest,
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

const MIN_PENDING_REVIEW_LOADING_MS = 250;

const waitForMinimumLoadingWindow = async (startedAt: number) => {
  const remaining = MIN_PENDING_REVIEW_LOADING_MS - (Date.now() - startedAt);
  if (remaining <= 0) return;
  await new Promise((resolve) => window.setTimeout(resolve, remaining));
};

export function useAdminPendingMerchReviewModalController({
  loadProductDetail,
  approvePendingMerchRequest,
  rejectPendingMerchRequest,
  reload,
}: UseAdminPendingMerchReviewModalControllerInput) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<PendingMerchRequest | null>(null);
  const [rejectionReasonDraft, setRejectionReasonDraft] = useState('');
  const [marketplaceFiles, setMarketplaceFiles] = useState<File[]>([]);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const marketplaceInputRef = useRef<HTMLInputElement | null>(null);

  const resetState = () => {
    setIsOpen(false);
    setIsLoading(false);
    setError(null);
    setSuccessMessage(null);
    setIsSubmitting(false);
    setSelectedRequest(null);
    setRejectionReasonDraft('');
    setMarketplaceFiles([]);
    setFieldErrors({});
    if (marketplaceInputRef.current) {
      marketplaceInputRef.current.value = '';
    }
  };

  const close = () => {
    resetState();
  };

  const openForRequest = async (request: PendingMerchRequest) => {
    const nextRejectionReason = readText(request.rejectionReason);
    const hydrationStartedAt = Date.now();
    setIsOpen(true);
    setIsLoading(true);
    setError(null);
    setSuccessMessage(null);
    setIsSubmitting(false);
    setSelectedRequest(request);
    setRejectionReasonDraft(nextRejectionReason);
    setMarketplaceFiles([]);
    setFieldErrors({});
    if (marketplaceInputRef.current) {
      marketplaceInputRef.current.value = '';
    }
    try {
      const detailProduct = (await loadProductDetail(request.id)) as PendingMerchRequest | null;
      if (detailProduct && typeof detailProduct === 'object') {
        const mergedRequest = mergePendingReviewRequest(request, detailProduct);
        setSelectedRequest(mergedRequest);
        setRejectionReasonDraft(
          readText(request.rejectionReason || detailProduct.rejectionReason)
        );
      }
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load pending merchandise details.');
    } finally {
      await waitForMinimumLoadingWindow(hydrationStartedAt);
      setIsLoading(false);
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

  const setMarketplaceFilesFromInput = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setError(null);
    setSuccessMessage(null);
    if (files.length > MAX_MARKETPLACE_IMAGES) {
      setMarketplaceFiles([]);
      setFieldErrors((prev) => ({
        ...prev,
        marketplace_images: `You can upload up to ${MAX_MARKETPLACE_IMAGES} marketplace images.`,
      }));
      if (marketplaceInputRef.current) {
        marketplaceInputRef.current.value = '';
      }
      return;
    }
    setMarketplaceFiles(files);
    const validationErrors = validatePendingApprovalFiles(files);
    setFieldErrors((prev) => ({
      ...prev,
      marketplace_images: validationErrors.marketplace_images || '',
    }));
  };

  const removeMarketplaceImage = (index: number) => {
    setError(null);
    setSuccessMessage(null);
    const nextFiles = marketplaceFiles.filter((_, fileIndex) => fileIndex !== index);
    setMarketplaceFiles(nextFiles);
    const validationErrors = validatePendingApprovalFiles(nextFiles);
    setFieldErrors((current) => ({
      ...current,
      marketplace_images: validationErrors.marketplace_images || '',
    }));
    if (marketplaceInputRef.current) {
      marketplaceInputRef.current.value = '';
    }
  };

  const approve = async () => {
    if (!selectedRequest?.id || isSubmitting) return;
    const validationErrors = validatePendingApprovalFiles(marketplaceFiles);
    setFieldErrors((prev) => ({
      ...prev,
      marketplace_images: validationErrors.marketplace_images || '',
    }));
    if (Object.keys(validationErrors).length > 0) {
      setError('Please upload 4 to 6 valid marketplace images (JPG or PNG) before approval.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccessMessage(null);
    try {
      await approvePendingMerchRequest(selectedRequest.id, marketplaceFiles);
      setSuccessMessage('Merch request approved successfully.');
      await reload();
      close();
    } catch (err: any) {
      setError(mapPendingApproveErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const reject = async () => {
    if (!selectedRequest?.id || isSubmitting) return;
    setIsSubmitting(true);
    setError(null);
    setSuccessMessage(null);
    try {
      await rejectPendingMerchRequest(selectedRequest.id, readText(rejectionReasonDraft) || null);
      setSuccessMessage('Merch request rejected.');
      await reload();
      close();
    } catch (err: any) {
      setError(mapPendingRejectErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const reviewStatus = normalizeStatus(selectedRequest?.status || 'pending') || 'pending';
  const reviewRejectionReason = readText(selectedRequest?.rejectionReason);
  const isMutable = reviewStatus === 'pending';

  const marketplaceValidationErrors = useMemo(
    () => validatePendingApprovalFiles(marketplaceFiles),
    [marketplaceFiles]
  );

  const marketplaceError =
    readText(fieldErrors.marketplace_images) ||
    readText(marketplaceValidationErrors.marketplace_images);

  const approveDisabledReason = isLoading
    ? 'Loading request details...'
    : isSubmitting
      ? 'Approval is in progress...'
      : !isMutable
        ? 'Only pending requests can be approved.'
        : marketplaceError;

  const approveDisabled = Boolean(approveDisabledReason);

  const designPreview = resolveMediaUrl(selectedRequest?.designImageUrl || null);

  return {
    isOpen,
    isLoading,
    isSubmitting,
    error,
    successMessage,
    selectedRequest,
    rejectionReasonDraft,
    marketplaceFiles,
    marketplaceInputRef,
    reviewStatus,
    reviewRejectionReason,
    isMutable,
    marketplaceError,
    approveDisabledReason,
    approveDisabled,
    designPreview,
    openForRequest,
    close,
    setMarketplaceFilesFromInput,
    removeMarketplaceImage,
    approve,
    reject,
    setRejectionReasonDraft,
  };
}
