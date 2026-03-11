import React from 'react';
import ErrorBanner from '../../../shared/components/ux/ErrorBanner';
import { useToast } from '../../../shared/components/ux/ToastHost';
import { Container, Page } from '../../../shared/ui/Page';
import AdminArtistRequestReviewModal from '../components/artistRequests/AdminArtistRequestReviewModal';
import AdminArtistRequestsHeader from '../components/artistRequests/AdminArtistRequestsHeader';
import AdminArtistRequestsList from '../components/artistRequests/AdminArtistRequestsList';
import AdminArtistRequestsState from '../components/artistRequests/AdminArtistRequestsState';
import { useAdminArtistRequestsPage } from '../artistRequests/useAdminArtistRequestsPage';

export default function AdminArtistRequestsPage() {
  const { notify } = useToast();
  const {
    token,
    requests,
    total,
    loading,
    error,
    statusFilter,
    setStatusFilter,
    page,
    setPage,
    reviewRequest,
    savingId,
    savingAction,
    rejectComment,
    setRejectComment,
    modalError,
    finalPlanType,
    paymentMode,
    transactionId,
    approvalPassword,
    approveFieldErrors,
    premiumPlanEnabled,
    pagination,
    loadRequests,
    openReview,
    closeReview,
    performAction,
    onFinalPlanTypeChange,
    onPaymentModeChange,
    onTransactionIdChange,
    onApprovalPasswordChange,
  } = useAdminArtistRequestsPage({ notify });

  if (!token) {
    return <AdminArtistRequestsState mode="auth" />;
  }

  if (loading) {
    return <AdminArtistRequestsState mode="loading" />;
  }

  return (
    <Page>
      <Container className="space-y-6">
        <AdminArtistRequestsHeader
          statusFilter={statusFilter}
          total={total}
          onStatusFilterChange={(value) => {
            setStatusFilter(value);
            setPage(1);
          }}
        />

        {error && <ErrorBanner message={error} onRetry={loadRequests} />}

        <AdminArtistRequestsList
          requests={requests}
          page={page}
          total={total}
          pageSize={pagination.pageSize}
          offset={pagination.offset}
          onOpenReview={openReview}
          onPrevPage={() => setPage((prev) => Math.max(1, prev - 1))}
          onNextPage={() => setPage((prev) => prev + 1)}
        />
      </Container>

      <AdminArtistRequestReviewModal
        reviewRequest={reviewRequest}
        finalPlanType={finalPlanType}
        paymentMode={paymentMode}
        transactionId={transactionId}
        approvalPassword={approvalPassword}
        rejectComment={rejectComment}
        modalError={modalError}
        approveFieldErrors={approveFieldErrors}
        premiumPlanEnabled={premiumPlanEnabled}
        savingId={savingId}
        savingAction={savingAction}
        onClose={closeReview}
        onFinalPlanTypeChange={onFinalPlanTypeChange}
        onPaymentModeChange={onPaymentModeChange}
        onTransactionIdChange={onTransactionIdChange}
        onApprovalPasswordChange={onApprovalPasswordChange}
        onRejectCommentChange={setRejectComment}
        onAction={performAction}
      />
    </Page>
  );
}
