import { useCallback, useEffect, useMemo, useState } from 'react';
import { getAccessToken } from '../../../shared/auth/tokenStore';
import {
  fetchAdminArtistRequests,
  fetchPremiumPlanEnabled,
  normalizePlan,
  saveAdminArtistRequestDecision,
} from './adminArtistRequestsApi';
import {
  ARTIST_REQUESTS_LIMIT,
  STATUS_OPTIONS,
  type ApproveFieldErrors,
  type ArtistRequest,
  type SaveAction,
  type StatusOption,
} from './types';

type UseAdminArtistRequestsPageOptions = {
  notify: (message: string, type?: 'success' | 'error' | 'info') => void;
};

export function useAdminArtistRequestsPage({ notify }: UseAdminArtistRequestsPageOptions) {
  const token = getAccessToken();
  const [requests, setRequests] = useState<ArtistRequest[]>([]);
  const [total, setTotal] = useState(0);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savingAction, setSavingAction] = useState<SaveAction | null>(null);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<StatusOption>('pending');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviewRequest, setReviewRequest] = useState<ArtistRequest | null>(null);
  const [rejectComment, setRejectComment] = useState('');
  const [modalError, setModalError] = useState<string | null>(null);
  const [finalPlanType, setFinalPlanType] = useState<string>('basic');
  const [paymentMode, setPaymentMode] = useState<'cash' | 'online' | ''>('');
  const [transactionId, setTransactionId] = useState('');
  const [approvalPassword, setApprovalPassword] = useState('');
  const [approveFieldErrors, setApproveFieldErrors] = useState<ApproveFieldErrors>({});
  const [premiumPlanEnabled, setPremiumPlanEnabled] = useState(false);

  const pageSize = ARTIST_REQUESTS_LIMIT;
  const offset = (page - 1) * pageSize;

  const loadRequests = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const payload = await fetchAdminArtistRequests({ page, statusFilter });
      setRequests(payload.items);
      setTotal(payload.total);
      setPage(payload.page);
    } catch (err: any) {
      const message =
        err?.error === 'internal_server_error'
          ? 'Unable to load artist requests'
          : err?.message ?? 'Unable to load artist requests';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, token]);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  useEffect(() => {
    if (!token) {
      setPremiumPlanEnabled(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const enabled = await fetchPremiumPlanEnabled();
        if (!cancelled) {
          setPremiumPlanEnabled(enabled);
        }
      } catch {
        if (!cancelled) {
          setPremiumPlanEnabled(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (!reviewRequest) return;
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, [reviewRequest]);

  const openReview = useCallback((request: ArtistRequest) => {
    const requested = normalizePlan(String(request.requestedPlanType || ''));
    const defaultPlan = requested || 'basic';
    setReviewRequest(request);
    setFinalPlanType(defaultPlan);
    setPaymentMode('');
    setTransactionId('');
    setApprovalPassword('');
    setApproveFieldErrors({});
    setRejectComment('');
    setModalError(null);
  }, []);

  const closeReview = useCallback(() => {
    setReviewRequest(null);
    setFinalPlanType('basic');
    setPaymentMode('');
    setTransactionId('');
    setApprovalPassword('');
    setApproveFieldErrors({});
    setRejectComment('');
    setModalError(null);
  }, []);

  const onFinalPlanTypeChange = useCallback((value: string) => {
    const next = normalizePlan(value || '');
    setFinalPlanType(next);
    setModalError(null);
    setApproveFieldErrors((prev) => {
      const updated = { ...prev };
      delete updated.finalPlanType;
      if (next === 'basic') {
        delete updated.paymentMode;
        delete updated.transactionId;
      }
      return updated;
    });
  }, []);

  const onPaymentModeChange = useCallback((value: 'cash' | 'online' | '') => {
    setPaymentMode(value);
    setModalError(null);
    setApproveFieldErrors((prev) => {
      const updated = { ...prev };
      delete updated.paymentMode;
      return updated;
    });
  }, []);

  const onTransactionIdChange = useCallback((value: string) => {
    setTransactionId(value);
    setModalError(null);
    setApproveFieldErrors((prev) => {
      const updated = { ...prev };
      delete updated.transactionId;
      return updated;
    });
  }, []);

  const onApprovalPasswordChange = useCallback((value: string) => {
    setApprovalPassword(value);
    setModalError(null);
    setApproveFieldErrors((prev) => {
      const updated = { ...prev };
      delete updated.approvalPassword;
      return updated;
    });
  }, []);

  const performAction = useCallback(
    async (request: ArtistRequest, action: SaveAction) => {
      if (!request?.id) return;
      const trimmedComment = rejectComment.trim();
      if (action === 'reject' && !trimmedComment) {
        setModalError('Rejection comment is required.');
        return;
      }

      if (action === 'approve') {
        const normalizedFinalPlanType = normalizePlan(finalPlanType);
        const nextFieldErrors: ApproveFieldErrors = {};
        if (!normalizedFinalPlanType) {
          nextFieldErrors.finalPlanType = 'FINAL_PLAN_TYPE IS REQUIRED';
        }
        if (normalizedFinalPlanType === 'premium' && !premiumPlanEnabled) {
          nextFieldErrors.finalPlanType = 'Premium plan is not enabled.';
        }
        if (normalizedFinalPlanType === 'advanced' || normalizedFinalPlanType === 'premium') {
          if (!paymentMode) {
            nextFieldErrors.paymentMode = 'Payment Mode is required.';
          }
          if (!transactionId.trim()) {
            nextFieldErrors.transactionId = 'Transaction ID is required.';
          }
        }
        const trimmedApprovalPassword = approvalPassword.trim();
        if (!trimmedApprovalPassword) {
          nextFieldErrors.approvalPassword = 'Artist login password is required.';
        } else if (trimmedApprovalPassword.length < 8) {
          nextFieldErrors.approvalPassword = 'Password must be at least 8 characters.';
        }
        if (Object.keys(nextFieldErrors).length > 0) {
          setApproveFieldErrors(nextFieldErrors);
          setModalError('Please fix the approval fields.');
          return;
        }
      }

      setSavingId(request.id);
      setSavingAction(action);
      setApproveFieldErrors({});
      setModalError(null);

      try {
        await saveAdminArtistRequestDecision({
          requestId: request.id,
          action,
          rejectComment,
          finalPlanType,
          paymentMode,
          transactionId,
          approvalPassword,
        });

        notify(
          action === 'approve'
            ? 'Artist request approved successfully.'
            : 'Artist request rejected successfully.',
          'success'
        );

        await loadRequests();
        closeReview();
      } catch (err: any) {
        if (action === 'approve' && Number(err?.status) === 400) {
          const message = String(err?.payload?.message ?? err?.message ?? 'Approval validation failed');
          const lower = message.toLowerCase();
          const nextFieldErrors: ApproveFieldErrors = {};
          if (lower.includes('final_plan_type')) {
            nextFieldErrors.finalPlanType = message;
          }
          if (lower.includes('payment_mode')) {
            nextFieldErrors.paymentMode = message;
          }
          if (lower.includes('transaction_id')) {
            nextFieldErrors.transactionId = message;
          }
          if (lower.includes('password')) {
            nextFieldErrors.approvalPassword = message;
          }
          setApproveFieldErrors(nextFieldErrors);
          setModalError(message);
        } else {
          setModalError(err?.message ?? 'Action failed');
        }
      } finally {
        setSavingId(null);
        setSavingAction(null);
      }
    },
    [
      approvalPassword,
      closeReview,
      finalPlanType,
      loadRequests,
      notify,
      paymentMode,
      premiumPlanEnabled,
      rejectComment,
      transactionId,
    ]
  );

  const pagination = useMemo(
    () => ({
      page,
      pageSize,
      total,
      offset,
      totalPages: Math.ceil(total / pageSize) || 1,
    }),
    [offset, page, pageSize, total]
  );

  return {
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
    statusOptions: STATUS_OPTIONS,
    loadRequests,
    openReview,
    closeReview,
    performAction,
    onFinalPlanTypeChange,
    onPaymentModeChange,
    onTransactionIdChange,
    onApprovalPasswordChange,
  };
}
