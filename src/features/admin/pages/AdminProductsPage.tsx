import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { apiFetch, apiFetchForm } from '../../../shared/api/http';
import { resolveMediaUrl } from '../../../shared/utils/media';
import { formatOnboardingSkuTypeLabel } from '../../../shared/utils/onboardingSkuTypes';

import type {
  Artist,
  FieldErrors,
  PendingMerchRequest,
  Product,
  ProductEditSnapshot,
  ProductsTab,
} from './AdminProductsPage.utils';
import {
  MAX_LISTING_PHOTOS,
  LISTING_PHOTO_ACCEPT,
  MIN_MARKETPLACE_IMAGES,
  MAX_MARKETPLACE_IMAGES,
  MARKETPLACE_IMAGE_ACCEPT,
  extractItems,
  extractListingPhotoUrls,
  firstText,
  hasSnapshotChanges,
  isAllowedListingPhoto,
  isAllowedMarketplaceImage,
  logAdminEditModalDebug,
  makeEditSnapshot,
  mapEditSaveErrorMessage,
  mapPendingApproveErrorMessage,
  mapPendingRejectErrorMessage,
  normalizeArtistItem,
  normalizePendingRequestItem,
  normalizeProductItem,
  normalizeStatus,
  readPendingSkuTypes,
  readText,
  resolvePendingSubmittedAt,
  resolveProductId,
} from './AdminProductsPage.utils';
export default function AdminProductsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<ProductsTab>('catalog');
  const [products, setProducts] = useState<Product[]>([]);
  const [pendingRequests, setPendingRequests] = useState<PendingMerchRequest[]>([]);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editArtistId, setEditArtistId] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editListingPhotoUrls, setEditListingPhotoUrls] = useState<string[]>([]);
  const [editReplacementPhotos, setEditReplacementPhotos] = useState<File[]>([]);
  const [editReplacementPhotoPreviews, setEditReplacementPhotoPreviews] = useState<string[]>([]);
  const [editActive, setEditActive] = useState(true);
  const [editFieldErrors, setEditFieldErrors] = useState<FieldErrors>({});
  const [editPhotoNotice, setEditPhotoNotice] = useState<string | null>(null);
  const [editInitialSnapshot, setEditInitialSnapshot] = useState<ProductEditSnapshot | null>(null);
  const editPhotoInputRef = useRef<HTMLInputElement | null>(null);

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
  const queryOpenedEditProductIdRef = useRef<string>('');
  const editInteractionRef = useRef<boolean>(false);
  const editModalHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const lastEditModalDebugStateRef = useRef<string>('');

  const markEditInteraction = () => {
    editInteractionRef.current = true;
  };

  const syncEditModalQueryParam = (productId?: string | null) => {
    const params = new URLSearchParams(location.search);
    const normalizedId = readText(productId);
    if (normalizedId) {
      params.set('editProductId', normalizedId);
    } else {
      params.delete('editProductId');
      params.delete('edit');
      params.delete('productId');
    }
    const nextSearch = params.toString();
    const currentSearch = location.search.startsWith('?')
      ? location.search.slice(1)
      : location.search;
    if (nextSearch === currentSearch) return;
    navigate(
      {
        pathname: location.pathname,
        search: nextSearch ? `?${nextSearch}` : '',
      },
      { replace: true }
    );
  };

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [productsResult, artistsResult, pendingResult] = await Promise.allSettled([
        apiFetch('/admin/products', { cache: 'no-store' }),
        apiFetch('/artists', { cache: 'no-store' }),
        apiFetch('/admin/products/onboarding?status=pending', { cache: 'no-store' }),
      ]);

      if (productsResult.status !== 'fulfilled') {
        throw productsResult.reason;
      }

      const productsPayload = productsResult.value;
      const artistsPayload = artistsResult.status === 'fulfilled' ? artistsResult.value : null;
      const pendingPayload = pendingResult.status === 'fulfilled' ? pendingResult.value : null;

      const productItems = extractItems(productsPayload, ['items', 'products', 'rows', 'data'])
        .map((item: any) => normalizeProductItem(item))
        .filter((item: Product | null): item is Product => Boolean(item));
      const artistItems = extractItems(artistsPayload, ['artists', 'items', 'data'])
        .map((item: any) => normalizeArtistItem(item))
        .filter((item: Artist | null): item is Artist => Boolean(item));
      const pendingItems = extractItems(pendingPayload, ['items', 'products', 'rows', 'data'])
        .map((item: any) => normalizePendingRequestItem(item))
        .filter(
          (item: PendingMerchRequest | null): item is PendingMerchRequest => Boolean(item)
        );

      setProducts(productItems);
      setArtists(artistItems);
      setPendingRequests(
        pendingItems.filter((item) => normalizeStatus(item?.status) === 'pending')
      );
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load admin products');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (editReplacementPhotos.length === 0) {
      setEditReplacementPhotoPreviews([]);
      return;
    }
    const previews = editReplacementPhotos.map((file) => URL.createObjectURL(file));
    setEditReplacementPhotoPreviews(previews);
    return () => {
      previews.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [editReplacementPhotos]);

  const artistLabelById = useMemo(() => {
    const map: Record<string, string> = {};
    artists.forEach((artist) => {
      const label = artist?.name || artist?.handle || artist?.id;
      map[artist.id] = label;
    });
    return map;
  }, [artists]);

  const applyEditProductToForm = (product: Product) => {
    const nextArtistId = String(product.artistId || product.artist_id || '').trim();
    const nextTitle = firstText(product as Record<string, any>, ['title', 'name']);
    const nextDescription = firstText(product as Record<string, any>, ['merch_story', 'merchStory', 'description']);
    const nextListingPhotoUrls = extractListingPhotoUrls(product);
    const nextActive = Boolean(product.isActive ?? product.is_active ?? product.active);

    setEditingProduct(product);
    setEditArtistId(nextArtistId);
    setEditTitle(nextTitle);
    setEditDescription(nextDescription);
    setEditListingPhotoUrls(nextListingPhotoUrls);
    setEditActive(nextActive);
    setEditInitialSnapshot(
      makeEditSnapshot({
        title: nextTitle,
        description: nextDescription,
        isActive: nextActive,
      })
    );
    setEditPhotoNotice(null);
  };

  const validateEditForm = ({
    includeTextFields,
    changedSnapshot,
  }: {
    includeTextFields: boolean;
    changedSnapshot: ProductEditSnapshot | null;
  }): FieldErrors => {
    const errors: FieldErrors = {};
    if (includeTextFields && editInitialSnapshot && changedSnapshot) {
      if (
        changedSnapshot.title !== editInitialSnapshot.title &&
        editTitle.trim().length < 2
      ) {
        errors.title = 'Merch Name must be at least 2 characters';
      }
      if (
        changedSnapshot.description !== editInitialSnapshot.description &&
        editDescription.trim().length < 10
      ) {
        errors.merch_story = 'Merch Story must be at least 10 characters';
      }
    }
    if (editReplacementPhotos.length > 0 && editReplacementPhotos.length !== MAX_LISTING_PHOTOS) {
      errors.listing_photos = 'Please select exactly 4 images to replace all photos.';
    }
    const hasUnsupportedFile = editReplacementPhotos.some((file) => !isAllowedListingPhoto(file));
    if (hasUnsupportedFile) {
      errors.listing_photos = 'Only PNG, JPG, and WEBP images are allowed.';
    }
    return errors;
  };

  const currentEditSnapshot = useMemo(
    () =>
      makeEditSnapshot({
        title: editTitle,
        description: editDescription,
        isActive: editActive,
      }),
    [editTitle, editDescription, editActive]
  );

  const hasTextChanges = useMemo(() => {
    return hasSnapshotChanges(currentEditSnapshot, editInitialSnapshot);
  }, [currentEditSnapshot, editInitialSnapshot]);

  const hasPhotoChanges = editReplacementPhotos.length > 0;
  const hasPendingChanges = hasTextChanges || hasPhotoChanges;
  const blockingValidationErrors = useMemo(
    () =>
      validateEditForm({
        includeTextFields: hasTextChanges,
        changedSnapshot: currentEditSnapshot,
      }),
    [hasTextChanges, currentEditSnapshot, editTitle, editDescription, editReplacementPhotos, editInitialSnapshot]
  );
  const hasBlockingValidation = Object.keys(blockingValidationErrors).length > 0;

  const openPhotoPicker = () => {
    if (editPhotoInputRef.current) {
      editPhotoInputRef.current.value = '';
    }
    editPhotoInputRef.current?.click();
  };

  const onReplacementPhotosChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    markEditInteraction();
    const files = Array.from(event.target.files || []);
    setEditError(null);
    setEditPhotoNotice(null);

    if (files.length === 0) {
      setEditReplacementPhotos([]);
      setEditFieldErrors((prev) => {
        const next = { ...prev };
        delete next.listing_photos;
        return next;
      });
      return;
    }

    if (files.some((file) => !isAllowedListingPhoto(file))) {
      setEditReplacementPhotos([]);
      setEditFieldErrors((prev) => ({
        ...prev,
        listing_photos: 'Only PNG, JPG, and WEBP images are allowed.',
      }));
      if (editPhotoInputRef.current) {
        editPhotoInputRef.current.value = '';
      }
      return;
    }

    const limitedFiles = files.slice(0, MAX_LISTING_PHOTOS);
    setEditReplacementPhotos(limitedFiles);
    if (files.length > MAX_LISTING_PHOTOS) {
      setEditPhotoNotice('Only the first 4 selected images will be used.');
    }
    setEditFieldErrors((prev) => {
      const next = { ...prev };
      if (limitedFiles.length !== MAX_LISTING_PHOTOS) {
        next.listing_photos = 'Please select exactly 4 images to replace all photos.';
      } else {
        delete next.listing_photos;
      }
      return next;
    });
  };

  const openEditModalById = async (
    productId: string,
    seedProduct?: Product | null,
    options?: { syncQuery?: boolean }
  ) => {
    const normalizedId = readText(productId);
    if (!normalizedId) return;
    const shouldSyncQuery = options?.syncQuery !== false;
    logAdminEditModalDebug('open_requested', {
      productId: normalizedId,
      syncQuery: shouldSyncQuery,
    });

    if (shouldSyncQuery) {
      queryOpenedEditProductIdRef.current = normalizedId;
      syncEditModalQueryParam(normalizedId);
    }

    const placeholderProduct: Product = {
      id: normalizedId,
      productId: normalizedId,
      title: '',
      description: '',
      isActive: true,
      listingPhotoUrls: [],
    };

    setIsEditOpen(true);
    setEditLoading(true);
    setEditError(null);
    setEditFieldErrors({});
    setEditReplacementPhotos([]);
    setEditReplacementPhotoPreviews([]);
    setEditPhotoNotice(null);
    setEditInitialSnapshot(null);
    editInteractionRef.current = false;
    logAdminEditModalDebug('open_state_set', {
      productId: normalizedId,
      isEditOpen: true,
      editLoading: true,
    });
    if (editPhotoInputRef.current) {
      editPhotoInputRef.current.value = '';
    }
    applyEditProductToForm(seedProduct || placeholderProduct);
    try {
      const payload = await apiFetch(`/products/${normalizedId}`);
      const detailProduct = (payload?.product ?? payload) as Product | null;
      if (detailProduct && typeof detailProduct === 'object' && !editInteractionRef.current) {
        applyEditProductToForm({
          ...(seedProduct || placeholderProduct),
          ...detailProduct,
          id: normalizedId,
          productId: readText(detailProduct.productId || detailProduct.id) || normalizedId,
        });
      }
    } catch (err: any) {
      setEditError(err?.message ?? 'Failed to load full product details');
    } finally {
      setEditLoading(false);
      logAdminEditModalDebug('open_hydration_done', {
        productId: normalizedId,
        headingMounted: Boolean(editModalHeadingRef.current),
      });
    }
  };

  const openEditModal = async (product: Product) => {
    const productId = resolveProductId(product);
    if (!productId) return;
    await openEditModalById(productId, product, { syncQuery: true });
  };

  const closeEditModal = () => {
    logAdminEditModalDebug('close_requested', {
      productId: resolveProductId(editingProduct),
    });
    setIsEditOpen(false);
    setEditLoading(false);
    setEditError(null);
    setEditFieldErrors({});
    setEditingProduct(null);
    setEditArtistId('');
    setEditTitle('');
    setEditDescription('');
    setEditListingPhotoUrls([]);
    setEditReplacementPhotos([]);
    setEditReplacementPhotoPreviews([]);
    setEditActive(true);
    setEditPhotoNotice(null);
    setEditInitialSnapshot(null);
    editInteractionRef.current = false;
    queryOpenedEditProductIdRef.current = '';
    syncEditModalQueryParam(null);
    if (editPhotoInputRef.current) {
      editPhotoInputRef.current.value = '';
    }
  };

  useEffect(() => {
    const stateToken = [
      isEditOpen ? 'open' : 'closed',
      editLoading ? 'loading' : 'idle',
      Boolean(editModalHeadingRef.current) ? 'heading-mounted' : 'heading-missing',
      resolveProductId(editingProduct) || '-',
    ].join('|');
    if (stateToken === lastEditModalDebugStateRef.current) return;
    lastEditModalDebugStateRef.current = stateToken;
    logAdminEditModalDebug('modal_state', {
      isEditOpen,
      editLoading,
      headingMounted: Boolean(editModalHeadingRef.current),
      productId: resolveProductId(editingProduct),
    });
  }, [isEditOpen, editLoading, editingProduct]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const requestedId = readText(
      params.get('editProductId') || params.get('edit') || params.get('productId')
    );
    if (!requestedId) {
      queryOpenedEditProductIdRef.current = '';
      return;
    }

    if (queryOpenedEditProductIdRef.current === requestedId) {
      return;
    }
    queryOpenedEditProductIdRef.current = requestedId;
    const seedProduct = products.find((product) => resolveProductId(product) === requestedId) || null;
    void openEditModalById(requestedId, seedProduct, { syncQuery: false });
  }, [location.search, products, isEditOpen]);

  const saveEdit = async () => {
    if (!editingProduct?.id || saving) return;

    const baselineSnapshot = editInitialSnapshot || snapshotFromProduct(editingProduct);
    const shouldPatchProduct = hasSnapshotChanges(currentEditSnapshot, baselineSnapshot);
    const shouldUploadPhotos = editReplacementPhotos.length > 0;

    if (!shouldPatchProduct && !shouldUploadPhotos) {
      setEditError('No changes to save yet.');
      return;
    }

    const validationErrors = validateEditForm({
      includeTextFields: shouldPatchProduct,
      changedSnapshot: currentEditSnapshot,
    });
    setEditFieldErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      setEditError('Please fix the highlighted fields.');
      return;
    }

    setSaving(true);
    setEditError(null);

    try {
      if (shouldPatchProduct) {
        await apiFetch(`/admin/products/${editingProduct.id}`, {
          method: 'PATCH',
          body: {
            title: editTitle.trim(),
            description: editDescription.trim(),
            merch_story: editDescription.trim(),
            isActive: editActive,
          },
        });
      }

      if (shouldUploadPhotos) {
        const fd = new FormData();
        editReplacementPhotos.forEach((file) => {
          fd.append('photos', file);
        });
        const photoUpdate = await apiFetchForm(`/admin/products/${editingProduct.id}/photos`, fd, {
          method: 'PUT',
        });
        const latestUrls = Array.isArray(photoUpdate?.listingPhotoUrls)
          ? photoUpdate.listingPhotoUrls
            .map((entry: any) => resolveMediaUrl(typeof entry === 'string' ? entry : null))
            .filter((entry: string | null): entry is string => Boolean(entry))
          : [];
        setEditListingPhotoUrls(latestUrls.slice(0, 4));
        setEditReplacementPhotos([]);
      }

      closeEditModal();
      await load();
    } catch (err: any) {
      setEditError(mapEditSaveErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

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
    resetPendingModalState();
    setPendingModalLoading(true);
    try {
      const payload = await apiFetch(`/products/${request.id}`, { cache: 'no-store' });
      const detailProduct = (payload?.product ?? payload) as PendingMerchRequest | null;
      if (detailProduct && typeof detailProduct === 'object') {
        setPendingReviewRequest((prev) => ({
          ...(prev || request),
          ...detailProduct,
          id: request.id,
          artistId: request.artistId || request.artist_id || detailProduct.artistId || detailProduct.artist_id,
          artistName: request.artistName || request.artistHandle || detailProduct.artistName,
          artistHandle: request.artistHandle || detailProduct.artistHandle,
          status: request.status || detailProduct.status || 'pending',
          skuTypes: Array.isArray(request.skuTypes) ? request.skuTypes : Array.isArray(request.sku_types) ? request.sku_types : Array.isArray(detailProduct.skuTypes) ? detailProduct.skuTypes : [],
          sku_types: Array.isArray(request.sku_types) ? request.sku_types : Array.isArray(request.skuTypes) ? request.skuTypes : Array.isArray(detailProduct.sku_types) ? detailProduct.sku_types : [],
          designImageUrl:
            resolveMediaUrl(request.designImageUrl || request.design_image_url || detailProduct.designImageUrl || detailProduct.design_image_url || null) || '',
        }));
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

  const onPendingMarketplaceFilesChange = (event: React.ChangeEvent<HTMLInputElement>) => {
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
      const fd = new FormData();
      pendingMarketplaceFiles.forEach((file) => {
        fd.append('listing_photos', file);
      });
      await apiFetchForm(`/admin/products/${pendingReviewRequest.id}/onboarding/approve`, fd, {
        method: 'POST',
      });
      setPendingModalSuccess('Merch request approved successfully.');
      await load();
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
      await apiFetch(`/admin/products/${pendingReviewRequest.id}/onboarding/reject`, {
        method: 'POST',
        body: {
          rejection_reason: readText(pendingRejectionReason) || null,
        },
      });
      setPendingModalSuccess('Merch request rejected.');
      await load();
      closePendingModal();
    } catch (err: any) {
      setPendingModalError(mapPendingRejectErrorMessage(err));
    } finally {
      setPendingActionSaving(false);
    }
  };

  const visibleListingPhotoUrls =
    editReplacementPhotoPreviews.length > 0 ? editReplacementPhotoPreviews : editListingPhotoUrls;
  const photoFieldError = editFieldErrors.listing_photos || '';
  const photoHelperId = 'admin-edit-product-photo-helper';
  const photoErrorId = 'admin-edit-product-photo-error';
  const photoDescribedBy =
    editPhotoNotice && !photoFieldError ? `${photoHelperId} ${photoErrorId}` : photoHelperId;
  const saveDisabled = saving || editLoading || !hasPendingChanges || hasBlockingValidation;
  const pendingQueueCount = pendingRequests.length;
  const pendingReviewSkuTypes = pendingReviewRequest ? readPendingSkuTypes(pendingReviewRequest) : [];
  const pendingReviewArtistId = String(
    pendingReviewRequest?.artistId || pendingReviewRequest?.artist_id || ''
  ).trim();
  const pendingReviewArtistName =
    readText(pendingReviewRequest?.artistName) ||
    readText(pendingReviewRequest?.artistHandle) ||
    artistLabelById[pendingReviewArtistId] ||
    'Unknown Artist';
  const pendingReviewStatus = normalizeStatus(pendingReviewRequest?.status || 'pending') || 'pending';
  const pendingMarketplaceValidationErrors = validatePendingApprovalFiles(pendingMarketplaceFiles);
  const pendingMarketplaceError =
    readText(pendingFieldErrors.marketplace_images) ||
    readText(pendingMarketplaceValidationErrors.marketplace_images);
  const pendingApproveDisabledReason = pendingModalLoading
    ? 'Loading request details...'
    : pendingActionSaving
      ? 'Approval is in progress...'
      : pendingMarketplaceError;
  const pendingApproveDisabled = Boolean(pendingApproveDisabledReason);
  const pendingDesignPreview = resolveMediaUrl(
    pendingReviewRequest?.designImageUrl ||
      pendingReviewRequest?.design_image_url ||
      null
  );

  return (
    <main className="space-y-8 min-h-screen pb-20">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-slate-100 dark:border-white/5">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-600 dark:text-indigo-400">Inventory Management</p>
          </div>
          <h1 className="text-4xl font-black tracking-tight text-slate-900 dark:text-white">Products</h1>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <Link
            to="/partner/admin/inventory-skus"
            className="group relative inline-flex items-center justify-center rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-6 py-4 text-xs font-black uppercase tracking-[0.2em] text-slate-700 dark:text-slate-200 transition-all hover:scale-[1.02] hover:border-slate-900 dark:hover:border-white/20 hover:text-slate-900 dark:hover:text-white"
          >
            SKU Master
          </Link>
          <Link
            to="/partner/admin/products/new"
            className="group relative inline-flex items-center justify-center rounded-2xl bg-slate-900 dark:bg-white px-8 py-4 text-xs font-black uppercase tracking-[0.2em] text-white dark:text-slate-950 shadow-2xl shadow-slate-900/20 dark:shadow-white/10 transition-all hover:scale-[1.02] active:scale-95 overflow-hidden"
          >
            <span className="relative z-10 flex items-center gap-2">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" />
              </svg>
              Create Product
            </span>
          </Link>
          <Link
            className="group flex items-center gap-2 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-6 py-4 text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:border-slate-900 dark:hover:border-white/20 transition-all shadow-sm"
            to="/partner/admin"
          >
            <svg className="h-4 w-4 transition-transform group-hover:-translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Dashboard
          </Link>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setActiveTab('catalog')}
          className={`rounded-xl border px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] transition-all ${
            activeTab === 'catalog'
              ? 'border-slate-900 dark:border-white bg-slate-900 dark:bg-white text-white dark:text-slate-950'
              : 'border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          Catalog Products
        </button>
        <button
          type="button"
          data-testid="admin-pending-merch-tab"
          onClick={() => setActiveTab('pending')}
          className={`rounded-xl border px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] transition-all ${
            activeTab === 'pending'
              ? 'border-slate-900 dark:border-white bg-slate-900 dark:bg-white text-white dark:text-slate-950'
              : 'border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          Pending Merch ({pendingQueueCount})
        </button>
      </div>

      {error && (
        <div className="rounded-2xl bg-rose-50 dark:bg-rose-500/10 p-4 border border-rose-100 dark:border-rose-500/20">
          <p className="text-sm font-bold text-rose-600 dark:text-rose-400 flex items-center gap-2">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error}
          </p>
        </div>
      )}

      {activeTab === 'catalog' && (
        <div
          data-testid="admin-products-list"
          className="overflow-hidden rounded-[2rem] border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 shadow-2xl shadow-slate-200/50 dark:shadow-none"
        >
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-black/20 text-left text-[10px] font-black uppercase tracking-[0.25em] text-slate-400 dark:text-slate-500">
              <th className="px-8 py-5">Product Info</th>
              <th className="px-8 py-5">Artist</th>
              <th className="px-8 py-5">Performance</th>
              <th className="px-8 py-5">Status</th>
              <th className="px-8 py-5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {!loading && products.length === 0 && (
              <tr>
                <td colSpan={5} className="px-8 py-12 text-center">
                  <div className="flex flex-col items-center gap-2 text-slate-400">
                    <svg className="h-12 w-12 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4a2 2 0 012-2m16 0h-4m-8 0H4" />
                    </svg>
                    <p className="text-sm font-bold uppercase tracking-widest">No products found</p>
                  </div>
                </td>
              </tr>
            )}
            {products.map((product) => {
              const active = Boolean(product.isActive ?? product.is_active);
              const statusLabel =
                typeof product.status === 'string' && product.status.trim().length > 0
                  ? product.status.toLowerCase()
                  : active
                    ? 'active'
                    : 'inactive';
              const rowProductId = String(product.productId || product.id || '').trim();
              const artistId = product.artistId || product.artist_id || '';
              const thumbnail = extractListingPhotoUrls(product)[0] || '';

              return (
                <tr
                  key={rowProductId || product.id}
                  data-testid="admin-product-row"
                  data-product-id={rowProductId}
                  className="group border-b border-slate-50 dark:border-white/5 hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors"
                >
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-4">
                      {thumbnail ? (
                        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-slate-200 dark:border-white/10 shadow-sm transition-transform group-hover:scale-105">
                          <img
                            data-testid="admin-product-row-thumbnail"
                            src={thumbnail}
                            alt={product.title ?? 'Product'}
                            className="h-full w-full object-cover"
                          />
                        </div>
                      ) : (
                        <div
                          data-testid="admin-product-row-thumbnail-empty"
                          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-white/5 text-slate-400"
                        >
                          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                      )}
                      <div>
                        <p className="font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                          {product.title ?? 'Untitled Product'}
                        </p>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">ID: {product.id.slice(0, 8)}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                      {artistLabelById[artistId] || 'Unknown Artist'}
                    </span>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-slate-900 dark:text-white uppercase">
                        {(String(product.merchType || product.merch_type || 'Other')).replace('_', ' ')}
                      </span>
                      <span className="text-[10px] text-slate-400 uppercase tracking-tighter">Category</span>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest ring-1 ring-inset ${active
                        ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-emerald-500/20'
                        : 'bg-slate-50 dark:bg-white/5 text-slate-400 dark:text-slate-500 ring-slate-200 dark:ring-white/10'
                      }`}>
                      {statusLabel}
                    </span>
                  </td>
                  <td className="px-8 py-5 text-right">
                    <div className="flex justify-end items-center gap-2">
                      <button
                        type="button"
                        data-testid="admin-product-row-edit"
                        onClick={() => openEditModal(product)}
                        className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300 hover:bg-slate-900 dark:hover:bg-white hover:text-white dark:hover:text-slate-950 transition-all shadow-sm"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => navigate(`/partner/admin/products/${rowProductId}/variants`)}
                        className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300 hover:bg-slate-900 dark:hover:bg-white hover:text-white dark:hover:text-slate-950 transition-all shadow-sm"
                      >
                        Variants
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      )}

      {activeTab === 'pending' && (
        <div className="rounded-[2rem] border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 p-6 space-y-4 shadow-2xl shadow-slate-200/50 dark:shadow-none">
          {loading ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">Loading pending requests...</p>
          ) : pendingRequests.length === 0 ? (
            <p className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/20 px-4 py-6 text-center text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              No pending merchandise requests.
            </p>
          ) : (
            <div className="space-y-3">
              {pendingRequests.map((request) => {
                const requestId = String(request.id || request.productId || '').trim();
                const statusLabel = normalizeStatus(request.status || 'pending') || 'pending';
                const artistId = String(request.artistId || request.artist_id || '').trim();
                const artistLabel =
                  readText(request.artistName) ||
                  readText(request.artistHandle) ||
                  artistLabelById[artistId] ||
                  'Unknown Artist';
                const skuTypes = readPendingSkuTypes(request);
                const designImage = resolveMediaUrl(
                  request.designImageUrl || request.design_image_url || null
                );
                return (
                  <article
                    key={requestId || `${request.title || 'pending'}-${request.createdAt || request.created_at || ''}`}
                    data-testid="admin-pending-merch-row"
                    className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-black/20 p-4"
                  >
                    <div className="grid gap-4 md:grid-cols-[160px_1fr_auto]">
                      <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/20 overflow-hidden h-32">
                        {designImage ? (
                          <img
                            src={designImage}
                            alt={request.title || 'Design preview'}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            No design
                          </div>
                        )}
                      </div>
                      <div className="space-y-2">
                        <p className="text-sm font-black text-slate-900 dark:text-white">
                          {request.title || request.name || 'Untitled merch'}
                        </p>
                        <p className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          Artist: {artistLabel}
                        </p>
                        <p className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          Submitted: {resolvePendingSubmittedAt(request)}
                        </p>
                        <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2">
                          {readText(request.description) || readText(request.merch_story) || '-'}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {skuTypes.length > 0 ? (
                            <>
                              <span className="sr-only">
                                {skuTypes.map((entry) => formatOnboardingSkuTypeLabel(entry)).join(', ')}
                              </span>
                              {skuTypes.map((skuType, index) => (
                                <span
                                  key={`${requestId}-${skuType}-${index}`}
                                  className="rounded-full border border-slate-200 dark:border-white/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-slate-600 dark:text-slate-300"
                                >
                                  {formatOnboardingSkuTypeLabel(skuType)}
                                </span>
                              ))}
                            </>
                          ) : (
                            <span className="text-[10px] uppercase tracking-widest text-slate-400">No SKU types</span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-3">
                        <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest ring-1 ring-inset bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 ring-amber-500/20">
                          {statusLabel}
                        </span>
                        <button
                          type="button"
                          data-testid="admin-pending-merch-open"
                          onClick={() => openPendingModal(request)}
                          className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300 hover:bg-slate-900 dark:hover:bg-white hover:text-white dark:hover:text-slate-950 transition-all shadow-sm"
                        >
                          View Details
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}

      {isPendingOpen && pendingReviewRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-[2.5rem] border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950 shadow-2xl animate-in zoom-in-95 duration-300 custom-scrollbar flex flex-col">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 dark:border-white/10 bg-white/90 dark:bg-slate-950/90 px-8 py-6 backdrop-blur-sm">
              <div>
                <h2 className="text-2xl font-black text-slate-900 dark:text-white">Pending Merch Review</h2>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Admin Approval Queue</p>
              </div>
              <button
                type="button"
                onClick={closePendingModal}
                className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white transition shadow-sm"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-8 space-y-6 flex-1">
              {pendingModalError && (
                <div className="rounded-2xl bg-rose-50 dark:bg-rose-500/10 p-4 border border-rose-100 dark:border-rose-500/20">
                  <p className="text-xs font-bold text-rose-600 dark:text-rose-400 uppercase tracking-widest">{pendingModalError}</p>
                </div>
              )}
              {pendingModalSuccess && (
                <div className="rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 p-4 border border-emerald-100 dark:border-emerald-500/20">
                  <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-widest">{pendingModalSuccess}</p>
                </div>
              )}

              {pendingModalLoading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent"></div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Loading request details...</p>
                </div>
              ) : (
                <>
                  <div className="grid gap-6 md:grid-cols-[220px_1fr]">
                    <div className="space-y-2">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Design Preview</p>
                      <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/20 overflow-hidden aspect-square">
                        {pendingDesignPreview ? (
                          <img
                            data-testid="admin-pending-merch-design-preview"
                            src={pendingDesignPreview}
                            alt={pendingReviewRequest.title || 'Design preview'}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div
                            data-testid="admin-pending-merch-design-preview"
                            className="h-full w-full flex items-center justify-center text-[10px] font-bold uppercase tracking-wider text-slate-400"
                          >
                            No preview
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Merch Name</p>
                        <p data-testid="admin-pending-merch-name" className="text-lg font-bold text-slate-900 dark:text-white">
                          {pendingReviewRequest.title || pendingReviewRequest.name || 'Untitled merch'}
                        </p>
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Artist</p>
                          <p data-testid="admin-pending-merch-artist" className="text-sm font-medium text-slate-700 dark:text-slate-200">
                            {pendingReviewArtistName}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Submitted At</p>
                          <p data-testid="admin-pending-merch-submitted-at" className="text-sm font-medium text-slate-700 dark:text-slate-200">
                            {resolvePendingSubmittedAt(pendingReviewRequest)}
                          </p>
                        </div>
                        <div className="sm:col-span-2">
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Current Status</p>
                          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{pendingReviewStatus}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Selected SKU Types</p>
                    <div data-testid="admin-pending-merch-skus" className="flex flex-wrap gap-2">
                      {pendingReviewSkuTypes.length > 0 ? (
                        <>
                          <span className="sr-only">
                            {pendingReviewSkuTypes
                              .map((entry) => formatOnboardingSkuTypeLabel(entry))
                              .join(', ')}
                          </span>
                          {pendingReviewSkuTypes.map((skuType, index) => (
                            <span
                              key={`pending-sku-${skuType}-${index}`}
                              className="rounded-full border border-slate-200 dark:border-white/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-slate-600 dark:text-slate-300"
                            >
                              {formatOnboardingSkuTypeLabel(skuType)}
                            </span>
                          ))}
                        </>
                      ) : (
                        <span className="text-[10px] uppercase tracking-widest text-slate-400">No SKU types</span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Merch Story</p>
                    <p
                      data-testid="admin-pending-merch-story"
                      className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/20 p-4 text-sm leading-relaxed text-slate-700 dark:text-slate-200 whitespace-pre-wrap"
                    >
                      {readText(pendingReviewRequest.description) || readText(pendingReviewRequest.merch_story) || '-'}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/20 p-4 space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Marketplace Listing Images (JPG/PNG)</p>
                    <input
                      ref={pendingMarketplaceInputRef}
                      data-testid="admin-marketplace-images-input"
                      type="file"
                      multiple
                      accept={MARKETPLACE_IMAGE_ACCEPT}
                      onChange={onPendingMarketplaceFilesChange}
                      className="block w-full text-sm text-slate-700 dark:text-slate-200 file:mr-3 file:rounded-full file:border file:border-slate-200 dark:file:border-white/10 file:bg-white dark:file:bg-black/20 file:px-4 file:py-2 file:text-[10px] file:font-black file:uppercase file:tracking-widest"
                    />
                    <p data-testid="admin-marketplace-image-count" className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      {pendingMarketplaceFiles.length} selected (required {MIN_MARKETPLACE_IMAGES}-{MAX_MARKETPLACE_IMAGES})
                    </p>
                    <ul data-testid="admin-marketplace-upload-list" className="space-y-1">
                      {pendingMarketplaceFiles.length > 0 ? (
                        pendingMarketplaceFiles.map((file, index) => (
                          <li
                            key={`${file.name}-${file.lastModified}-${index}`}
                            className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-black/30 px-3 py-2"
                          >
                            <span className="truncate text-[10px] font-bold uppercase tracking-widest text-slate-600 dark:text-slate-300">
                              {file.name}
                            </span>
                            <button
                              type="button"
                              data-testid="admin-marketplace-image-remove"
                              onClick={() => removePendingMarketplaceImage(index)}
                              disabled={pendingActionSaving}
                              className="rounded-full border border-slate-200 dark:border-white/10 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-300 disabled:opacity-50"
                            >
                              Remove
                            </button>
                          </li>
                        ))
                      ) : (
                        <li className="text-[10px] uppercase tracking-widest text-slate-400">No images selected</li>
                      )}
                    </ul>
                    {pendingMarketplaceError && (
                      <p data-testid="admin-marketplace-upload-error" className="text-[10px] font-bold uppercase tracking-widest text-rose-600 dark:text-rose-300">
                        {pendingMarketplaceError}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Rejection Reason (optional)</p>
                    <textarea
                      data-testid="admin-rejection-reason"
                      value={pendingRejectionReason}
                      onChange={(event) => setPendingRejectionReason(event.target.value)}
                      rows={3}
                      className="block w-full rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-black/20 px-4 py-3 text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 outline-none transition shadow-inner"
                      placeholder="Optional note to include when rejecting this request."
                    />
                  </div>
                </>
              )}
            </div>

            <div className="sticky bottom-0 bg-white/90 dark:bg-slate-950/90 border-t border-slate-100 dark:border-white/10 p-8 flex flex-wrap gap-3 backdrop-blur-sm">
              <button
                type="button"
                data-testid="admin-approve-merch"
                onClick={approvePendingRequest}
                disabled={pendingApproveDisabled}
                className="rounded-[1.25rem] bg-emerald-600 py-3 px-6 text-[10px] font-black uppercase tracking-[0.3em] text-white shadow-xl transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:scale-100"
              >
                {pendingActionSaving ? 'Processing...' : 'Approve'}
              </button>
              {pendingApproveDisabledReason && (
                <p data-testid="admin-approve-disabled-reason" className="self-center text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-300">
                  {pendingApproveDisabledReason}
                </p>
              )}
              <button
                type="button"
                data-testid="admin-reject-merch"
                onClick={rejectPendingRequest}
                disabled={pendingModalLoading || pendingActionSaving}
                className="rounded-[1.25rem] bg-rose-600 py-3 px-6 text-[10px] font-black uppercase tracking-[0.3em] text-white shadow-xl transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:scale-100"
              >
                {pendingActionSaving ? 'Processing...' : 'Reject'}
              </button>
              <button
                type="button"
                onClick={closePendingModal}
                className="rounded-[1.25rem] border-2 border-slate-200 dark:border-white/10 bg-white dark:bg-transparent px-8 py-3 text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white hover:border-slate-900 dark:hover:border-white/20 transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {isEditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div
            data-testid="admin-product-edit-modal"
            aria-labelledby="admin-product-edit-modal-heading"
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[2.5rem] border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950 shadow-2xl animate-in zoom-in-95 duration-300 custom-scrollbar flex flex-col"
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 dark:border-white/10 bg-white/90 dark:bg-slate-950/90 px-8 py-6 backdrop-blur-sm">
              <div>
                <h2
                  ref={editModalHeadingRef}
                  id="admin-product-edit-modal-heading"
                  data-testid="admin-product-edit-modal-heading"
                  className="text-2xl font-black text-slate-900 dark:text-white"
                >
                  Edit Product
                </h2>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Settings & Details</p>
              </div>
              <button
                type="button"
                onClick={closeEditModal}
                className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white transition shadow-sm"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-8 space-y-8 flex-1">
              {editError && (
                <div className="rounded-2xl bg-rose-50 dark:bg-rose-500/10 p-4 border border-rose-100 dark:border-rose-500/20">
                  <p className="text-xs font-bold text-rose-600 dark:text-rose-400 uppercase tracking-widest">{editError}</p>
                </div>
              )}

              {editLoading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent"></div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Fetching Matrix...</p>
                </div>
              ) : (
                <>
                  <div className="grid gap-6 md:grid-cols-2">
                    <label className="block space-y-2">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Artist</span>
                      <input
                        data-testid="admin-edit-product-artist"
                        value={artistLabelById[editArtistId] || editArtistId || '-'}
                        readOnly
                        disabled
                        className="block w-full rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/40 px-5 py-3 text-sm font-medium text-slate-400 dark:text-white/40 cursor-not-allowed uppercase tracking-widest shadow-inner"
                      />
                    </label>

                    <label className="block space-y-2">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Merch Name *</span>
                      <input
                        data-testid="admin-edit-product-merch-name"
                        value={editTitle}
                        onChange={(e) => {
                          markEditInteraction();
                          setEditTitle(e.target.value);
                        }}
                        className="block w-full rounded-2xl border border-slate-200 dark:border-white/15 bg-white dark:bg-black/20 px-5 py-3 text-sm font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 outline-none transition shadow-inner"
                      />
                      {editFieldErrors.title && <p className="text-[10px] text-rose-500 font-bold uppercase">{editFieldErrors.title}</p>}
                    </label>

                    <label className="block space-y-2 md:col-span-2">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Description *</span>
                      <textarea
                        data-testid="admin-edit-product-story"
                        value={editDescription}
                        onChange={(e) => {
                          markEditInteraction();
                          setEditDescription(e.target.value);
                        }}
                        rows={4}
                        className="block w-full rounded-2xl border border-slate-200 dark:border-white/15 bg-white dark:bg-black/20 px-5 py-4 text-sm leading-relaxed text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 outline-none transition shadow-inner"
                      />
                      {editFieldErrors.merch_story && <p className="text-[10px] text-rose-500 font-bold uppercase">{editFieldErrors.merch_story}</p>}
                    </label>
                    <div className="flex items-center gap-6 md:col-span-2">
                      <label className="relative flex cursor-pointer items-center gap-3">
                        <div className="relative">
                          <input
                            type="checkbox"
                            checked={editActive}
                            onChange={(e) => {
                              markEditInteraction();
                              setEditActive(e.target.checked);
                            }}
                            className="peer sr-only"
                          />
                          <div className="h-6 w-11 rounded-full bg-slate-200 dark:bg-white/10 peer-checked:bg-emerald-500 transition-colors"></div>
                          <div className="absolute left-1 top-1 h-4 w-4 rounded-full bg-white transition-transform peer-checked:translate-x-5"></div>
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Active Status</span>
                      </label>
                    </div>
                  </div>
                  <fieldset
                    className={`rounded-3xl border p-6 bg-slate-50/50 dark:bg-black/20 ${
                      photoFieldError
                        ? 'border-rose-300 dark:border-rose-500/40'
                        : 'border-slate-200 dark:border-white/10'
                    }`}
                  >
                    <legend className="px-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Visual Assets (4 Required)</legend>
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                      {Array.from({ length: MAX_LISTING_PHOTOS }).map((_, idx) => {
                        const src = visibleListingPhotoUrls[idx];
                        return (
                          <div
                            key={idx}
                            data-testid={`admin-edit-product-photo-slot-${idx + 1}`}
                            className="aspect-square rounded-2xl border-2 border-slate-200 dark:border-white/10 bg-white dark:bg-black/40 overflow-hidden"
                          >
                            {src ? (
                              <img
                                data-testid="admin-edit-product-photo-preview"
                                src={src}
                                alt={`Product preview ${idx + 1}`}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="h-full w-full flex items-center justify-center text-[10px] text-slate-300 font-black">SLOT {idx + 1}</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <button
                      type="button"
                      data-testid="admin-edit-product-photo-trigger"
                      onClick={openPhotoPicker}
                      disabled={saving || editLoading}
                      aria-describedby={photoDescribedBy}
                      aria-invalid={Boolean(photoFieldError)}
                      className="mt-8 group relative flex w-full flex-col items-center justify-center rounded-[2rem] border-2 border-dashed border-slate-300 dark:border-white/10 py-10 hover:border-indigo-500 transition-all text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      <div className="text-center space-y-2">
                        <p className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest">Replace All Photos</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase">
                          {editReplacementPhotos.length > 0
                            ? `${editReplacementPhotos.length} / ${MAX_LISTING_PHOTOS} selected`
                            : 'PNG / JPG / WEBP'}
                        </p>
                      </div>
                    </button>
                    <input
                      ref={editPhotoInputRef}
                      id="admin-edit-product-photo-input"
                      data-testid="admin-edit-product-photo-input"
                      type="file"
                      multiple
                      accept={LISTING_PHOTO_ACCEPT}
                      className="sr-only"
                      onChange={onReplacementPhotosChange}
                      aria-describedby={photoDescribedBy}
                      aria-invalid={Boolean(photoFieldError)}
                    />
                    <p
                      id={photoHelperId}
                      className={`mt-3 text-[10px] font-bold uppercase tracking-wider ${
                        photoFieldError
                          ? 'text-rose-500 dark:text-rose-400'
                          : 'text-slate-400 dark:text-slate-500'
                      }`}
                    >
                      {photoFieldError
                        ? photoFieldError
                        : 'Upload up to 4 product images (PNG, JPG, or WEBP).'}
                    </p>
                    {editPhotoNotice && !photoFieldError && (
                      <p
                        id={photoErrorId}
                        className="mt-1 text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400"
                      >
                        {editPhotoNotice}
                      </p>
                    )}
                  </fieldset>
                </>
              )}
            </div>

            <div className="sticky bottom-0 bg-white/90 dark:bg-slate-950/90 border-t border-slate-100 dark:border-white/10 p-8 flex gap-4 backdrop-blur-sm">
              <button
                data-testid="admin-edit-product-save"
                type="button"
                onClick={saveEdit}
                disabled={saveDisabled}
                className="flex-1 rounded-[1.25rem] bg-slate-900 dark:bg-white py-4 text-[10px] font-black uppercase tracking-[0.3em] text-white dark:text-slate-950 shadow-2xl transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:scale-100"
              >
                {saving ? 'Saving changes...' : 'Commit Changes'}
              </button>
              <button
                type="button"
                onClick={closeEditModal}
                className="rounded-[1.25rem] border-2 border-slate-200 dark:border-white/10 bg-white dark:bg-transparent px-8 py-4 text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white hover:border-slate-900 dark:hover:border-white/20 transition-all"
              >
                Discard
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
