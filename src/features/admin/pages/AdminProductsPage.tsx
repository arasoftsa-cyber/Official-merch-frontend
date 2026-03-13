import React, { useMemo, useState } from 'react';
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

import type { ProductsTab } from './AdminProductsPage.utils';
import { readText } from './AdminProductsPage.utils';

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

  const artistLabelById = useMemo(() => {
    const map: Record<string, string> = {};
    artists.forEach((artist) => {
      const label = artist?.name || artist?.handle || artist?.id;
      map[artist.id] = label;
    });
    return map;
  }, [artists]);

  const {
    saving,
    isEditOpen,
    editLoading,
    editError,
    editArtistId,
    editTitle,
    editDescription,
    editListingPhotoUrls,
    editReplacementPhotos,
    editReplacementPhotoPreviews,
    editActive,
    editFieldErrors,
    editPhotoNotice,
    editPhotoInputRef,
    editModalHeadingRef,
    saveDisabled,
    markEditInteraction,
    setEditTitle,
    setEditDescription,
    setEditActive,
    openPhotoPicker,
    onReplacementPhotosChange,
    openEditModal,
    closeEditModal,
    saveEdit,
  } = useAdminProductEditModalController({
    products,
    loadProductDetail,
    saveProductEdits,
    reload,
  });

  const {
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
  } = useAdminPendingMerchReviewModalController({
    loadProductDetail,
    approvePendingMerchRequest,
    rejectPendingMerchRequest,
    reload,
  });

  const visibleListingPhotoUrls =
    editReplacementPhotoPreviews.length > 0 ? editReplacementPhotoPreviews : editListingPhotoUrls;
  const photoFieldError = editFieldErrors.listing_photos || '';
  const photoHelperId = 'admin-edit-product-photo-helper';
  const photoErrorId = 'admin-edit-product-photo-error';
  const photoDescribedBy =
    editPhotoNotice && !photoFieldError ? `${photoHelperId} ${photoErrorId}` : photoHelperId;

  const pendingQueueCount = pendingRequests.length;
  const pendingReviewArtistId = String(
    pendingReviewRequest?.artistId || pendingReviewRequest?.artist_id || ''
  ).trim();
  const pendingReviewArtistName =
    readText(pendingReviewRequest?.artistName) ||
    readText(pendingReviewRequest?.artistHandle) ||
    artistLabelById[pendingReviewArtistId] ||
    'Unknown Artist';

  return (
    <main className="space-y-8 min-h-screen pb-20">
      <AdminProductsHeader />

      <AdminProductsTabs
        activeTab={activeTab}
        pendingQueueCount={pendingQueueCount}
        onTabChange={setActiveTab}
      />

      {error && <AdminProductsErrorBanner error={error} />}

      {activeTab === 'catalog' && (
        <AdminProductsCatalogTable
          loading={loading}
          products={products}
          artistLabelById={artistLabelById}
          onEditProduct={openEditModal}
          onOpenVariants={(productId) => navigate(`/partner/admin/products/${productId}/variants`)}
        />
      )}

      {activeTab === 'pending' && (
        <AdminPendingMerchList
          loading={loading}
          pendingRequests={pendingRequests}
          artistLabelById={artistLabelById}
          onOpenPendingModal={openPendingModal}
        />
      )}

      {isPendingOpen && pendingReviewRequest && (
        <AdminPendingMerchReviewModal
          pendingReviewRequest={pendingReviewRequest}
          pendingModalError={pendingModalError}
          pendingModalSuccess={pendingModalSuccess}
          pendingModalLoading={pendingModalLoading}
          pendingDesignPreview={pendingDesignPreview}
          pendingReviewArtistName={pendingReviewArtistName}
          pendingReviewStatus={pendingReviewStatus}
          pendingReviewRejectionReason={pendingReviewRejectionReason}
          pendingReviewMutable={pendingReviewMutable}
          pendingMarketplaceInputRef={pendingMarketplaceInputRef}
          pendingMarketplaceFiles={pendingMarketplaceFiles}
          pendingMarketplaceError={pendingMarketplaceError}
          pendingRejectionReason={pendingRejectionReason}
          pendingActionSaving={pendingActionSaving}
          pendingApproveDisabled={pendingApproveDisabled}
          pendingApproveDisabledReason={pendingApproveDisabledReason}
          onClose={closePendingModal}
          onPendingMarketplaceFilesChange={onPendingMarketplaceFilesChange}
          onRemovePendingMarketplaceImage={removePendingMarketplaceImage}
          onSetPendingRejectionReason={setPendingRejectionReason}
          onApprovePendingRequest={approvePendingRequest}
          onRejectPendingRequest={rejectPendingRequest}
        />
      )}

      {isEditOpen && (
        <AdminProductEditModal
          saving={saving}
          editLoading={editLoading}
          editError={editError}
          editArtistId={editArtistId}
          editTitle={editTitle}
          editDescription={editDescription}
          editActive={editActive}
          editReplacementPhotos={editReplacementPhotos}
          editPhotoNotice={editPhotoNotice}
          editFieldErrors={editFieldErrors}
          artistLabelById={artistLabelById}
          visibleListingPhotoUrls={visibleListingPhotoUrls}
          photoFieldError={photoFieldError}
          photoHelperId={photoHelperId}
          photoErrorId={photoErrorId}
          photoDescribedBy={photoDescribedBy}
          saveDisabled={saveDisabled}
          editPhotoInputRef={editPhotoInputRef}
          editModalHeadingRef={editModalHeadingRef}
          onClose={closeEditModal}
          onSave={saveEdit}
          onOpenPhotoPicker={openPhotoPicker}
          onReplacementPhotosChange={onReplacementPhotosChange}
          onMarkInteraction={markEditInteraction}
          onSetEditTitle={setEditTitle}
          onSetEditDescription={setEditDescription}
          onSetEditActive={setEditActive}
        />
      )}
    </main>
  );
}
