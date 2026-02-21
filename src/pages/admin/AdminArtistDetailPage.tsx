import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import AppShell from '../../components/layout/AppShell';
import ErrorBanner from '../../components/ux/ErrorBanner';
import LoadingSkeleton from '../../components/ux/LoadingSkeleton';
import { apiFetch } from '../../shared/api/http';

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
    name: String(row?.name ?? row?.artist_name ?? row?.artistName ?? 'Unknown'),
    handle: String(row?.handle ?? ''),
    email: String(row?.email ?? row?.contact_email ?? ''),
    status: String(row?.status ?? 'active'),
    phone: String(row?.phone ?? row?.contact_phone ?? ''),
    aboutMe: String(row?.about_me ?? row?.aboutMe ?? ''),
    messageForFans: String(row?.message_for_fans ?? row?.messageForFans ?? ''),
    profilePhotoUrl: String(row?.profile_photo_url ?? row?.profile_photo_path ?? ''),
    socials,
    raw: row,
  };
};

export default function AdminArtistDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [detail, setDetail] = useState<AdminArtistDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [endpointUnavailable, setEndpointUnavailable] = useState(false);

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
      </div>

      {loading && <LoadingSkeleton count={2} />}
      {error && <ErrorBanner message={error} onRetry={load} />}

      {!loading && endpointUnavailable && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-slate-300">
          <p>Artist detail endpoint is not available yet.</p>
          <p className="mt-2 text-slate-400">
            Expected endpoint: <code>/api/admin/artists/{id}</code>
          </p>
        </div>
      )}

      {!loading && !endpointUnavailable && !error && detail && (
        <div className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-5">
          <p><span className="text-slate-400">Name:</span> {detail.name || '-'}</p>
          <p><span className="text-slate-400">Handle:</span> {detail.handle ? `@${detail.handle}` : '-'}</p>
          <p><span className="text-slate-400">Email:</span> {detail.email || '-'}</p>
          <p><span className="text-slate-400">Status:</span> {detail.status || '-'}</p>
          <p><span className="text-slate-400">Phone:</span> {detail.phone || '-'}</p>
          <p><span className="text-slate-400">About:</span> {detail.aboutMe || '-'}</p>
          <p><span className="text-slate-400">Message For Fans:</span> {detail.messageForFans || '-'}</p>

          <div>
            <p className="text-slate-400">Socials:</p>
            {detail.socials.length > 0 ? (
              <ul className="mt-1 list-disc space-y-1 pl-5">
                {detail.socials.map((social, idx) => (
                  <li key={`${idx}-${social.platform}-${social.profileLink}`}>
                    {(social.platform || 'platform').toUpperCase()}: {social.profileLink || '-'}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1">-</p>
            )}
          </div>

          <div>
            <p className="text-slate-400">Profile Photo:</p>
            {detail.profilePhotoUrl ? (
              <div className="mt-2 space-y-2">
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
              <p className="mt-1">-</p>
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}
