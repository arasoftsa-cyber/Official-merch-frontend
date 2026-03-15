import React, { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import AdminPendingMerchReviewModal from '../components/products/AdminPendingMerchReviewModal';
import AdminProductEditModal from '../components/products/AdminProductEditModal';
import AdminPendingMerchList from '../components/products/AdminPendingMerchList';
import AdminProductsCatalogTable from '../components/products/AdminProductsCatalogTable';
import AdminProductsErrorBanner from '../components/products/AdminProductsErrorBanner';
import AdminProductsHeader from '../components/products/AdminProductsHeader';
import AdminProductsTabs from '../components/products/AdminProductsTabs';
import { useAdminPendingMerchReviewModalController } from '../products/useAdminPendingMerchReviewModalController';
import { useAdminProductEditModalController } from '../products/useAdminProductEditModalController';
import { useAdminProductsPage } from '../products/useAdminProductsPage';

import type { PendingMerchRequest, Product, ProductsTab } from './AdminProductsPage.utils';
import { buildArtistLabelById, derivePendingMerchReviewDetails } from './AdminProductsPage.utils';

export default function AdminProductsPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<ProductsTab>('catalog');
  const {
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
  } = useAdminProductsPage();

  const artistLabelById = useMemo(() => buildArtistLabelById(artists), [artists]);

  const productEditModal = useAdminProductEditModalController({
    products,
    loadProductDetail,
    saveProductEdits,
    reload,
  });

  const pendingMerchReviewModal = useAdminPendingMerchReviewModalController({
    loadProductDetail,
    approvePendingMerchRequest,
    rejectPendingMerchRequest,
    reload,
  });

  const pendingReviewDetails = useMemo(
    () => derivePendingMerchReviewDetails(pendingMerchReviewModal.selectedRequest, artistLabelById),
    [pendingMerchReviewModal.selectedRequest, artistLabelById]
  );

  const pendingQueueCount = pendingRequests.length;
  const showCatalogTab = activeTab === 'catalog';
  const showPendingTab = activeTab === 'pending';

  const handleTabChange = useCallback((nextTab: ProductsTab) => {
    setActiveTab(nextTab);
  }, []);

  const handleOpenEditProduct = useCallback(
    (product: Product) => productEditModal.openForProduct(product),
    [productEditModal]
  );

  const handleOpenPendingReview = useCallback(
    (request: PendingMerchRequest) => pendingMerchReviewModal.openForRequest(request),
    [pendingMerchReviewModal]
  );

  const handleOpenVariants = useCallback(
    (productId: string) => {
      navigate(`/partner/admin/products/${productId}/variants`);
    },
    [navigate]
  );

  return (
    <main className="space-y-8 min-h-screen pb-20">
      <AdminProductsHeader />

      <AdminProductsTabs
        activeTab={activeTab}
        pendingQueueCount={pendingQueueCount}
        onTabChange={handleTabChange}
      />

      {error && <AdminProductsErrorBanner error={error} />}

      {showCatalogTab && (
        <AdminProductsCatalogTable
          loading={loading}
          products={products}
          artistLabelById={artistLabelById}
          onEditProduct={handleOpenEditProduct}
          onOpenVariants={handleOpenVariants}
        />
      )}

      {showPendingTab && (
        <AdminPendingMerchList
          loading={loading}
          pendingRequests={pendingRequests}
          artistLabelById={artistLabelById}
          onOpenPendingModal={handleOpenPendingReview}
        />
      )}

      <AdminPendingMerchReviewModal
        isOpen={pendingMerchReviewModal.isOpen}
        selectedRequest={pendingMerchReviewModal.selectedRequest}
        isLoading={pendingMerchReviewModal.isLoading}
        isSubmitting={pendingMerchReviewModal.isSubmitting}
        error={pendingMerchReviewModal.error}
        successMessage={pendingMerchReviewModal.successMessage}
        artistName={pendingReviewDetails.artistName}
        designPreview={pendingReviewDetails.designPreview}
        reviewStatus={pendingReviewDetails.status}
        reviewRejectionReason={pendingReviewDetails.rejectionReason}
        isMutable={pendingReviewDetails.isMutable}
        marketplaceFiles={pendingMerchReviewModal.marketplaceFiles}
        marketplaceError={pendingMerchReviewModal.marketplaceError}
        rejectionReasonDraft={pendingMerchReviewModal.rejectionReasonDraft}
        approveDisabled={pendingMerchReviewModal.approveDisabled}
        approveDisabledReason={pendingMerchReviewModal.approveDisabledReason}
        marketplaceInputRef={pendingMerchReviewModal.marketplaceInputRef}
        onClose={pendingMerchReviewModal.close}
        onMarketplaceFilesChange={pendingMerchReviewModal.setMarketplaceFilesFromInput}
        onRemoveMarketplaceImage={pendingMerchReviewModal.removeMarketplaceImage}
        onRejectionReasonChange={pendingMerchReviewModal.setRejectionReasonDraft}
        onApprove={pendingMerchReviewModal.approve}
        onReject={pendingMerchReviewModal.reject}
      />

      <AdminProductEditModal
        isOpen={productEditModal.isOpen}
        selectedProduct={productEditModal.selectedProduct}
        isLoading={productEditModal.isLoading}
        isSubmitting={productEditModal.isSubmitting}
        error={productEditModal.error}
        initialValues={productEditModal.initialValues}
        values={productEditModal.values}
        visibleListingPhotoUrls={productEditModal.visibleListingPhotoUrls}
        replacementPhotos={productEditModal.editReplacementPhotos}
        fieldErrors={productEditModal.editFieldErrors}
        photoFieldError={productEditModal.photoFieldError}
        photoNotice={productEditModal.editPhotoNotice}
        saveDisabled={productEditModal.saveDisabled}
        artistLabelById={artistLabelById}
        photoInputRef={productEditModal.editPhotoInputRef}
        headingRef={productEditModal.headingRef}
        onClose={productEditModal.close}
        onSubmit={productEditModal.submit}
        onOpenPhotoPicker={productEditModal.openPhotoPicker}
        onReplacementPhotosChange={productEditModal.setReplacementPhotos}
        onMarkInteraction={productEditModal.markEditInteraction}
        onTitleChange={productEditModal.setTitle}
        onDescriptionChange={productEditModal.setDescription}
        onActiveChange={productEditModal.setActive}
      />
    </main>
  );
}
