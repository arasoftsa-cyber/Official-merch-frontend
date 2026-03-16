import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import type {
  FieldErrors,
  Product,
  ProductEditFormValues,
  ProductEditSnapshot,
} from '../pages/AdminProductsPage.utils';
import {
  MAX_LISTING_PHOTOS,
  deriveProductEditFormValues,
  hasSnapshotChanges,
  isAllowedListingPhoto,
  logAdminEditModalDebug,
  makeEditSnapshot,
  mapEditSaveErrorMessage,
  readText,
  resolveProductId,
  snapshotFromProduct,
} from '../pages/AdminProductsPage.utils';

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

type UseAdminProductEditModalControllerInput = {
  products: Product[];
  loadProductDetail: (productId: string) => Promise<any>;
  saveProductEdits: (input: SaveProductEditsInput) => Promise<{ latestListingPhotoUrls: string[] }>;
  reload: () => Promise<void>;
};

const MIN_EDIT_HYDRATION_LOADING_MS = 250;

const waitForMinimumLoadingWindow = async (startedAt: number) => {
  const remaining = MIN_EDIT_HYDRATION_LOADING_MS - (Date.now() - startedAt);
  if (remaining <= 0) return;
  await new Promise((resolve) => window.setTimeout(resolve, remaining));
};

export function useAdminProductEditModalController({
  products,
  loadProductDetail,
  saveProductEdits,
  reload,
}: UseAdminProductEditModalControllerInput) {
  const location = useLocation();
  const navigate = useNavigate();

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

  const queryOpenedEditProductIdRef = useRef<string>('');
  const editInteractionRef = useRef<boolean>(false);
  const editModalHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const lastEditModalDebugStateRef = useRef<string>('');

  const markEditInteraction = () => {
    editInteractionRef.current = true;
  };

  const resetEditState = () => {
    setIsEditOpen(false);
    setEditLoading(false);
    setEditError(null);
    setEditingProduct(null);
    setEditArtistId('');
    setEditTitle('');
    setEditDescription('');
    setEditListingPhotoUrls([]);
    setEditReplacementPhotos([]);
    setEditReplacementPhotoPreviews([]);
    setEditActive(true);
    setEditFieldErrors({});
    setEditPhotoNotice(null);
    setEditInitialSnapshot(null);
    editInteractionRef.current = false;
    queryOpenedEditProductIdRef.current = '';
    if (editPhotoInputRef.current) {
      editPhotoInputRef.current.value = '';
    }
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

  const applyEditProductToForm = (product: Product) => {
    const nextValues = deriveProductEditFormValues(product);
    setEditingProduct(product);
    setEditArtistId(nextValues.artistId);
    setEditTitle(nextValues.title);
    setEditDescription(nextValues.description);
    setEditListingPhotoUrls(nextValues.listingPhotoUrls);
    setEditActive(nextValues.isActive);
    setEditInitialSnapshot(
      makeEditSnapshot({
        title: nextValues.title,
        description: nextValues.description,
        isActive: nextValues.isActive,
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
      if (changedSnapshot.title !== editInitialSnapshot.title && editTitle.trim().length < 2) {
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

  const hasTextChanges = useMemo(
    () => hasSnapshotChanges(currentEditSnapshot, editInitialSnapshot),
    [currentEditSnapshot, editInitialSnapshot]
  );

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
  const isSubmitting = saving;
  const saveDisabled = isSubmitting || editLoading || !hasPendingChanges || hasBlockingValidation;
  const initialValues: ProductEditFormValues | null =
    editInitialSnapshot && editingProduct
      ? {
          artistId: editArtistId,
          title: editInitialSnapshot.title,
          description: editInitialSnapshot.description,
          isActive: editInitialSnapshot.isActive,
          listingPhotoUrls: deriveProductEditFormValues(editingProduct).listingPhotoUrls,
        }
      : null;
  const values: ProductEditFormValues = {
    artistId: editArtistId,
    title: editTitle,
    description: editDescription,
    isActive: editActive,
    listingPhotoUrls: editListingPhotoUrls,
  };
  const selectedProduct = editingProduct;
  const error = editError;
  const isOpen = isEditOpen;
  const isLoading = editLoading;
  const visibleListingPhotoUrls =
    editReplacementPhotoPreviews.length > 0 ? editReplacementPhotoPreviews : editListingPhotoUrls;
  const photoFieldError = editFieldErrors.listing_photos || '';

  const openPhotoPicker = () => {
    if (editPhotoInputRef.current) {
      editPhotoInputRef.current.value = '';
    }
    editPhotoInputRef.current?.click();
  };

  const onReplacementPhotosChange = (event: ChangeEvent<HTMLInputElement>) => {
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
      name: '',
      description: '',
      merchType: '',
      merchStory: '',
      artistId: '',
      isActive: true,
      status: '',
      primaryPhotoUrl: '',
      listingPhotoUrl: '',
      listingPhotoUrls: [],
      createdAt: '',
      rejectionReason: null,
      skuTypes: [],
      designImageUrl: '',
      artistName: '',
      artistHandle: '',
    };
    const hydrationStartedAt = Date.now();

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
      const detailProduct = await loadProductDetail(normalizedId);
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
      await waitForMinimumLoadingWindow(hydrationStartedAt);
      setEditLoading(false);
      logAdminEditModalDebug('open_hydration_done', {
        productId: normalizedId,
        headingMounted: Boolean(editModalHeadingRef.current),
      });
    }
  };

  const openForProduct = async (product: Product) => {
    const productId = resolveProductId(product);
    if (!productId) return;
    await openEditModalById(productId, product, { syncQuery: true });
  };

  const close = () => {
    logAdminEditModalDebug('close_requested', {
      productId: resolveProductId(editingProduct),
    });
    resetEditState();
    syncEditModalQueryParam(null);
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
      const { latestListingPhotoUrls } = await saveProductEdits({
        productId: editingProduct.id,
        shouldPatchProduct,
        patchBody: {
          title: editTitle.trim(),
          description: editDescription.trim(),
          merch_story: editDescription.trim(),
          isActive: editActive,
        },
        shouldUploadPhotos,
        photos: editReplacementPhotos,
      });
      if (latestListingPhotoUrls.length > 0) {
        setEditListingPhotoUrls(latestListingPhotoUrls.slice(0, 4));
        setEditReplacementPhotos([]);
      }

      close();
      await reload();
    } catch (err: any) {
      setEditError(mapEditSaveErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return {
    isOpen,
    isLoading,
    isSubmitting,
    error,
    selectedProduct,
    initialValues,
    values,
    visibleListingPhotoUrls,
    photoFieldError,
    editReplacementPhotos,
    editFieldErrors,
    editPhotoNotice,
    editPhotoInputRef,
    headingRef: editModalHeadingRef,
    saveDisabled,
    markEditInteraction,
    setTitle: setEditTitle,
    setDescription: setEditDescription,
    setActive: setEditActive,
    openPhotoPicker,
    setReplacementPhotos: onReplacementPhotosChange,
    openForProduct,
    close,
    submit: saveEdit,
  };
}
