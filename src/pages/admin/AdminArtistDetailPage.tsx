import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import AppShell from '../../components/layout/AppShell';
import ErrorBanner from '../../components/ux/ErrorBanner';
import LoadingSkeleton from '../../components/ux/LoadingSkeleton';
import { apiFetch } from '../../shared/api/http';
import { resolveMediaUrl } from '../../shared/utils/media';
import AdminArtistEditModal from './AdminArtistEditModal';

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

export default function AdminArtistDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [detail, setDetail] = useState<AdminArtistDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [endpointUnavailable, setEndpointUnavailable] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

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
        <Link className="text-sm text-slate-300 underline" to="/partner/admin/artists">
          Back to artists
        </Link>
        {id && (
          <button
            type="button"
            onClick={() => setIsEditOpen(true)}
            className="rounded-lg border border-white/20 px-3 py-1 text-xs uppercase tracking-[0.25em] text-white"
          >
            Edit
          </button>
        )}
      </div>

      {loading && <LoadingSkeleton count={2} />}
      {error && <ErrorBanner message={error} onRetry={load} />}
      {success && (
        <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-200">
          {success}
        </div>
      )}

      {!loading && endpointUnavailable && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-slate-300">
          <p>Artist detail endpoint is not available yet.</p>
          <p className="mt-2 text-slate-400">
            Expected endpoint: <code>/api/admin/artists/{id}</code>
          </p>
        </div>
      )}

      {!loading && !endpointUnavailable && !error && detail && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="grid gap-x-6 gap-y-3 md:grid-cols-[180px_minmax(0,1fr)]">
            <p className="text-slate-400">Name</p>
            <p>{withDash(detail.name)}</p>

            <p className="text-slate-400">Handle</p>
            <p>{formatHandle(detail.handle)}</p>

            <p className="text-slate-400">Email</p>
            <p>{withDash(detail.email)}</p>

            <p className="text-slate-400">Status</p>
            <p>{withDash(detail.status)}</p>

            <p className="text-slate-400">Phone</p>
            <p>{withDash(detail.phone)}</p>

            <p className="text-slate-400">About</p>
            <p>{withDash(detail.aboutMe)}</p>

            <p className="text-slate-400">Message For Fans</p>
            <p>{withDash(detail.messageForFans)}</p>

            <p className="text-slate-400">Socials</p>
            <div className="space-y-1">
              {detail.socials.length > 0 ? (
                detail.socials.map((social, idx) => {
                  const platform = withDash(social.platform).toUpperCase();
                  const value = withDash(social.profileLink);
                  const href = normalizePossibleUrl(social.profileLink);
                  return (
                    <p key={`${idx}-${social.platform}-${social.profileLink}`}>
                      <span className="text-slate-300">{platform}:</span>{' '}
                      {href ? (
                        <a href={href} target="_blank" rel="noreferrer" className="text-emerald-300 underline">
                          {value}
                        </a>
                      ) : (
                        value
                      )}
                    </p>
                  );
                })
              ) : (
                <p>-</p>
              )}
            </div>

            <p className="text-slate-400">Profile Photo</p>
            <div>
              {detail.profilePhotoUrl ? (
                <div className="space-y-2">
                  <a href={detail.profilePhotoUrl} target="_blank" rel="noreferrer" className="text-emerald-300 underline">
                    Open profile photo
                  </a>
                  <img
                    src={detail.profilePhotoUrl}
                    alt={`${detail.name} profile`}
                    className="max-h-48 rounded-lg border border-white/10 object-contain"
                  />
                </div>
              ) : (
                <p>-</p>
              )}
            </div>
          </div>
        </div>
      )}

      <AdminArtistEditModal
        open={Boolean(isEditOpen && id)}
        artistId={id || null}
        onClose={() => setIsEditOpen(false)}
        onSaved={async () => {
          setSuccess('Artist updated successfully.');
          await load();
        }}
      />
    </AppShell>
  );
}
