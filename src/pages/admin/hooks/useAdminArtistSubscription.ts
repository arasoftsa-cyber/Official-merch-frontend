import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../../../shared/api/http';

export type AdminArtistSubscription = {
  id: string;
  artistId: string;
  requestedPlanType: string;
  approvedPlanType: string;
  startDate: string;
  endDate: string;
  paymentMode: string;
  transactionId: string;
  status: string;
  approvedAt: string;
  approvedByAdminId: string;
};

const toText = (value: unknown) => String(value ?? '').trim();

const toDateOnly = (value: unknown) => {
  const text = toText(value);
  if (!text) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  if (/^\d{4}-\d{2}-\d{2}T/.test(text)) return text.slice(0, 10);
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
};

export const normalizeAdminArtistSubscription = (
  payload: any
): AdminArtistSubscription | null => {
  if (!payload) return null;

  if (Object.prototype.hasOwnProperty.call(payload, 'subscription')) {
    if (!payload.subscription) return null;
    return normalizeAdminArtistSubscription(payload.subscription);
  }

  const row = payload?.item ?? payload;
  if (!row) return null;

  return {
    id: toText(row?.id),
    artistId: toText(row?.artistId ?? row?.artist_id),
    requestedPlanType: toText(row?.requestedPlanType ?? row?.requested_plan_type).toLowerCase(),
    approvedPlanType: toText(row?.approvedPlanType ?? row?.approved_plan_type).toLowerCase(),
    startDate: toDateOnly(row?.startDate ?? row?.start_date),
    endDate: toDateOnly(row?.endDate ?? row?.end_date),
    paymentMode: toText(row?.paymentMode ?? row?.payment_mode),
    transactionId: toText(row?.transactionId ?? row?.transaction_id),
    status: toText(row?.status).toLowerCase(),
    approvedAt: toText(row?.approvedAt ?? row?.approved_at),
    approvedByAdminId: toText(row?.approvedByAdminId ?? row?.approved_by_admin_id),
  };
};

export function useAdminArtistSubscription(artistId: string | null, enabled = true) {
  const [subscription, setSubscription] = useState<AdminArtistSubscription | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!enabled || !artistId) {
      setSubscription(null);
      setError(null);
      setLoading(false);
      return null;
    }

    setLoading(true);
    setError(null);
    try {
      const payload = await apiFetch(`/admin/artists/${artistId}/subscription`);
      const normalized = normalizeAdminArtistSubscription(payload);
      setSubscription(normalized);
      return normalized;
    } catch (err: any) {
      setSubscription(null);
      setError(String(err?.message ?? 'Failed to load subscription.'));
      return null;
    } finally {
      setLoading(false);
    }
  }, [artistId, enabled]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return {
    subscription,
    setSubscription,
    loading,
    error,
    reload,
  };
}
