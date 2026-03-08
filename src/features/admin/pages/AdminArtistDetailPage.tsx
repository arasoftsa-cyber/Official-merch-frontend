import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import AppShell from '../../../shared/components/layout/AppShell';
import ErrorBanner from '../../../shared/components/ux/ErrorBanner';
import LoadingSkeleton from '../../../shared/components/ux/LoadingSkeleton';
import { apiFetch } from '../../../shared/api/http';
import { resolveMediaUrl } from '../../../shared/utils/media';
import AdminArtistEditModal from './AdminArtistEditModal';
import { useAdminArtistSubscription } from '../hooks/useAdminArtistSubscription';

type AdminArtistDetail = {
  id: string;
  name: string;
  handle: string;
  email: string;
  status: string;
  phone: string;
  aboutMe: string;
  messageForFans: string;
  profilePhotoUrl: string;
  socials: Array<{ platform: string; profileLink: string }>;
  raw: any;
};

const normalizeDetail = (payload: any): AdminArtistDetail => {
  const row = payload?.item ?? payload?.artist ?? payload ?? {};
  const socialsValue = row?.socials;
  const socials = Array.isArray(socialsValue)
    ? socialsValue.map((s: any) => ({
      platform: String(s?.platform ?? ''),
      profileLink: String(s?.profileLink ?? s?.url ?? s?.link ?? ''),
    }))
    : [];

  return {
    id: String(row?.id ?? ''),
    name: String(row?.name ?? row?.artist_name ?? row?.artistName ?? ''),
    handle: String(row?.handle ?? ''),
    email: String(row?.email ?? row?.contact_email ?? ''),
    status: String(row?.status ?? ''),
    phone: String(row?.phone ?? row?.contact_phone ?? ''),
    aboutMe: String(row?.about_me ?? row?.aboutMe ?? ''),
    messageForFans: String(row?.message_for_fans ?? row?.messageForFans ?? ''),
    profilePhotoUrl:
      resolveMediaUrl(
        String(row?.profile_photo_url ?? row?.profilePhotoUrl ?? row?.profile_photo_path ?? '').trim() || null
      ) ?? '',
    socials,
    raw: row,
  };
};

const toText = (value: unknown) => String(value ?? '').trim();
const withDash = (value: unknown) => {
  const text = toText(value);
  return text || '-';
};
const formatHandle = (value: unknown) => {
  const handle = toText(value).replace(/^@+/, '');
  return handle ? `@${handle}` : '-';
};
const normalizePossibleUrl = (value: unknown) => {
  const text = toText(value);
  if (!text) return '';
  if (/^https?:\/\//i.test(text)) return text;
  if (/^www\./i.test(text)) return `https://${text}`;
  return '';
};
const toTitleCase = (value: unknown) => {
  const text = toText(value).toLowerCase();
  if (!text) return '-';
  return text
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};
const formatDateValue = (value: unknown) => {
  const text = toText(value);
  if (!text) return '-';
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return text;
  return date.toISOString().slice(0, 10);
};

export default function AdminArtistDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [detail, setDetail] = useState<AdminArtistDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [endpointUnavailable, setEndpointUnavailable] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const shouldLoadSubscription = Boolean(id && detail && !endpointUnavailable && !error);
  const {
    subscription,
    loading: subscriptionLoading,
    error: subscriptionError,
    reload: reloadSubscription,
  } = useAdminArtistSubscription(id || null, shouldLoadSubscription);

  const load = async () => {
    if (!id) {
      setError('Missing artist id.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    setEndpointUnavailable(false);
    try {
      const payload = await apiFetch(`/admin/artists/${id}`);
      setDetail(normalizeDetail(payload));
    } catch (err: any) {
      const message = String(err?.message ?? '');
      if (message.includes('HTTP_404')) {
        setEndpointUnavailable(true);
      } else {
        setError(message || 'Failed to load artist details.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [id]);

  return (
    <AppShell title="Admin Artist Detail" subtitle="Full artist details">
      <div className="flex items-center justify-between">
        <Link className="text-sm text-indigo-600 dark:text-slate-300 underline hover:text-indigo-800 dark:hover:text-white transition-colors" to="/partner/admin/artists">
          Back to artists
        </Link>
        {id && (
          <button
            type="button"
            onClick={() => setIsEditOpen(true)}
            className="rounded-lg border border-slate-300 dark:border-white/20 bg-slate-50 dark:bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition shadow-sm"
          >
            Edit
          </button>
        )}
      </div>

      {loading && <LoadingSkeleton count={2} />}
      {error && <ErrorBanner message={error} onRetry={load} />}
      {success && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-200 shadow-sm transition-all animate-in fade-in slide-in-from-top-2">
          {success}
        </div>
      )}

      {!loading && endpointUnavailable && (
        <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 p-6 text-sm text-slate-700 dark:text-slate-300 shadow-sm">
          <p className="font-medium">Artist detail endpoint is not available yet.</p>
          <p className="mt-2 text-slate-500 dark:text-slate-400">
            Expected endpoint: <code className="bg-slate-200 dark:bg-white/10 px-1 py-0.5 rounded text-xs font-mono">/api/admin/artists/{id}</code>
          </p>
        </div>
      )}

      {!loading && !endpointUnavailable && !error && detail && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 p-6 shadow-sm">
            <div className="grid gap-x-6 gap-y-3 md:grid-cols-[180px_minmax(0,1fr)]">
              <p className="text-slate-500 dark:text-slate-400 font-medium">Name</p>
              <p className="text-slate-900 dark:text-white">{withDash(detail.name)}</p>

              <p className="text-slate-500 dark:text-slate-400 font-medium">Handle</p>
              <p className="text-slate-900 dark:text-white">{formatHandle(detail.handle)}</p>

              <p className="text-slate-500 dark:text-slate-400 font-medium">Email</p>
              <p className="text-slate-900 dark:text-white">{withDash(detail.email)}</p>

              <p className="text-slate-500 dark:text-slate-400 font-medium">Status</p>
              <p className="text-slate-900 dark:text-white">{withDash(detail.status)}</p>

              <p className="text-slate-500 dark:text-slate-400 font-medium">Phone</p>
              <p className="text-slate-900 dark:text-white">{withDash(detail.phone)}</p>

              <p className="text-slate-500 dark:text-slate-400 font-medium">About</p>
              <p className="text-slate-900 dark:text-white whitespace-pre-wrap">{withDash(detail.aboutMe)}</p>

              <p className="text-slate-500 dark:text-slate-400 font-medium">Message For Fans</p>
              <p className="text-slate-900 dark:text-white whitespace-pre-wrap">{withDash(detail.messageForFans)}</p>

              <p className="text-slate-500 dark:text-slate-400 font-medium">Socials</p>
              <div className="space-y-2">
                {detail.socials.length > 0 ? (
                  detail.socials.map((social, idx) => {
                    const platform = withDash(social.platform).toUpperCase();
                    const value = withDash(social.profileLink);
                    const href = normalizePossibleUrl(social.profileLink);
                    return (
                      <p key={`${idx}-${social.platform}-${social.profileLink}`} className="text-slate-900 dark:text-white">
                        <span className="text-slate-500 dark:text-slate-400 text-xs font-semibold">{platform}:</span>{' '}
                        {href ? (
                          <a href={href} target="_blank" rel="noreferrer" className="text-indigo-600 dark:text-emerald-300 underline hover:text-indigo-800 dark:hover:text-emerald-200 transition-colors">
                            {value}
                          </a>
                        ) : (
                          value
                        )}
                      </p>
                    );
                  })
                ) : (
                  <p className="text-slate-900 dark:text-white">-</p>
                )}
              </div>

              <p className="text-slate-500 dark:text-slate-400 font-medium">Profile Photo</p>
              <div>
                {detail.profilePhotoUrl ? (
                  <div className="space-y-3">
                    <a href={detail.profilePhotoUrl} target="_blank" rel="noreferrer" className="inline-flex items-center text-sm text-indigo-600 dark:text-emerald-300 underline hover:text-indigo-800 dark:hover:text-emerald-200 transition-colors">
                      Open profile photo
                    </a>
                    <img
                      src={detail.profilePhotoUrl}
                      alt={`${detail.name} profile`}
                      className="max-h-48 rounded-xl border border-slate-200 dark:border-white/10 object-contain shadow-sm bg-white dark:bg-black/20"
                    />
                  </div>
                ) : (
                  <p className="text-slate-900 dark:text-white">-</p>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 p-6 shadow-sm">
            <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-300 flex items-center gap-2">
              <span className="w-1.5 h-4 bg-indigo-500 dark:bg-emerald-500 rounded-full"></span>
              Subscription
            </h3>
            {subscriptionLoading && (
              <p className="mt-3 text-sm text-slate-300">Loading subscription...</p>
            )}
            {!subscriptionLoading && subscriptionError && (
              <p className="mt-3 text-sm text-rose-300">{subscriptionError}</p>
            )}
            {!subscriptionLoading && !subscriptionError && !subscription && (
              <p className="mt-3 text-sm text-slate-300">No active subscription</p>
            )}
            {!subscriptionLoading && !subscriptionError && subscription && (
              <div className="mt-6 grid gap-x-6 gap-y-3 md:grid-cols-[180px_minmax(0,1fr)]">
                <p className="text-slate-500 dark:text-slate-400 font-medium">Approved Plan</p>
                <p className="text-slate-900 dark:text-white font-semibold">{toTitleCase(subscription.approvedPlanType)}</p>

                <p className="text-slate-500 dark:text-slate-400 font-medium">Requested Plan</p>
                <p className="text-slate-900 dark:text-white">{toTitleCase(subscription.requestedPlanType)}</p>

                <p className="text-slate-500 dark:text-slate-400 font-medium">Status</p>
                <p className="text-slate-900 dark:text-white">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${subscription.status === 'active' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' : 'bg-slate-100 text-slate-700 dark:bg-white/5 dark:text-slate-300'
                    }`}>
                    {toTitleCase(subscription.status)}
                  </span>
                </p>

                <p className="text-slate-500 dark:text-slate-400 font-medium">Start Date</p>
                <p className="text-slate-900 dark:text-white">{formatDateValue(subscription.startDate)}</p>

                <p className="text-slate-500 dark:text-slate-400 font-medium">End Date</p>
                <p className="text-slate-900 dark:text-white">{formatDateValue(subscription.endDate)}</p>

                <p className="text-slate-500 dark:text-slate-400 font-medium">Payment Mode</p>
                <p className="text-slate-900 dark:text-white font-mono text-xs">{withDash(subscription.paymentMode)}</p>

                <p className="text-slate-500 dark:text-slate-400 font-medium">Transaction ID</p>
                <p className="text-slate-900 dark:text-white font-mono text-xs break-all">{withDash(subscription.transactionId)}</p>
              </div>
            )}
          </div>
        </div>
      )}

      <AdminArtistEditModal
        open={Boolean(isEditOpen && id)}
        artistId={id || null}
        onClose={() => setIsEditOpen(false)}
        onSaved={async () => {
          setSuccess('Artist updated successfully.');
          await Promise.all([load(), reloadSubscription()]);
        }}
      />
    </AppShell>
  );
}
