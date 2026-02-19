import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import AppShell from '../../components/layout/AppShell';
import KpiCard from '../../components/ui/KpiCard';
import EmptyState from '../../components/ui/EmptyState';
import { apiFetch } from '../../shared/api/http';

type ArtistPortfolioRow = {
  artistId: string;
  artistName: string;
  orders30d: number;
  gross30d: number;
  units30d: number;
  activeProductsCount: number;
};

type LabelSummary = {
  totalArtists: number;
  activeArtists30d: number;
  inactiveArtists: number;
  totalGross: number;
  artists: ArtistPortfolioRow[];
};

const EMPTY_SUMMARY: LabelSummary = {
  totalArtists: 0,
  activeArtists30d: 0,
  inactiveArtists: 0,
  totalGross: 0,
  artists: [],
};

const toNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeSummary = (payload: any): LabelSummary => {
  const artistsRaw = Array.isArray(payload?.artists) ? payload.artists : [];
  const artists = artistsRaw.map((artist: any) => ({
    artistId: String(artist?.artistId ?? artist?.id ?? ''),
    artistName: String(artist?.artistName ?? artist?.name ?? artist?.handle ?? artist?.artistId ?? 'Unknown'),
    orders30d: toNumber(artist?.orders30d),
    gross30d: toNumber(artist?.gross30d),
    units30d: toNumber(artist?.units30d),
    activeProductsCount: toNumber(artist?.activeProductsCount),
  }));

  const totalArtists = toNumber(payload?.totalArtists || artists.length);
  const activeArtists30d = toNumber(payload?.activeArtists30d);
  const inactiveArtists =
    payload?.inactiveArtists !== undefined
      ? toNumber(payload?.inactiveArtists)
      : Math.max(totalArtists - activeArtists30d, 0);

  return {
    totalArtists,
    activeArtists30d,
    inactiveArtists,
    totalGross: toNumber(payload?.totalGross ?? payload?.grossCents ?? payload?.grossAllTimeCents),
    artists,
  };
};

const formatCurrency = (cents?: number) => {
  if (typeof cents !== 'number' || !Number.isFinite(cents)) return '-';
  return `$${(cents / 100).toFixed(2)}`;
};

export default function LabelDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const [summary, setSummary] = useState<LabelSummary>(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addArtistOpen, setAddArtistOpen] = useState(false);
  const [addArtistSuccess, setAddArtistSuccess] = useState<string | null>(null);
  const [addArtistError, setAddArtistError] = useState<string | null>(null);
  const [addArtistSubmitting, setAddArtistSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: '',
    handleSuggestion: '',
    contactEmail: '',
    contactPhone: '',
    socials: '',
    pitch: '',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const loadSummary = async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await apiFetch('/api/labels/dashboard/summary');
      setSummary(normalizeSummary(payload));
    } catch (err: any) {
      setSummary(EMPTY_SUMMARY);
      setError(err?.message ?? 'Failed to load label dashboard summary');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSummary();
  }, []);

  const isLabelHome =
    location.pathname === '/partner/label' || location.pathname === '/partner/label/';

  const validEmail = (value: string) => value.includes('@') && value.includes('.');
  const handleFormChange =
    (field: keyof typeof form) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm((prev) => ({ ...prev, [field]: event.target.value }));
      if (formErrors[field]) {
        setFormErrors((prev) => {
          const next = { ...prev };
          delete next[field];
          return next;
        });
      }
    };

  const submitArtistAccessRequest = async (event: React.FormEvent) => {
    event.preventDefault();
    if (addArtistSubmitting) return;

    const trimmedName = form.name.trim();
    const nextErrors: Record<string, string> = {};
    if (!trimmedName) {
      nextErrors.name = 'Name is required.';
    }
    if (form.contactEmail && !validEmail(form.contactEmail.trim())) {
      nextErrors.contactEmail = 'Enter a valid email.';
    }
    if (Object.keys(nextErrors).length) {
      setFormErrors(nextErrors);
      return;
    }

    setFormErrors({});
    setAddArtistError(null);
    setAddArtistSubmitting(true);
    try {
      const socialValue = form.socials.trim();
      await apiFetch('/api/artist-access-requests', {
        method: 'POST',
        body: {
          artistName: trimmedName,
          handle: form.handleSuggestion.trim() || null,
          contactEmail: form.contactEmail.trim() || null,
          contactPhone: form.contactPhone.trim() || null,
          socials: socialValue ? { link: socialValue } : null,
          pitch: form.pitch.trim() || null,
        },
      });

      setAddArtistOpen(false);
      setAddArtistSuccess('Artist access request submitted. Admin will review.');
      setForm({
        name: '',
        handleSuggestion: '',
        contactEmail: '',
        contactPhone: '',
        socials: '',
        pitch: '',
      });
    } catch (err: any) {
      setAddArtistError(err?.message ?? 'Failed to submit request');
    } finally {
      setAddArtistSubmitting(false);
    }
  };

  const cardWrapperClass =
    'group transition duration-150 hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-white/60';

  return (
    <AppShell title="Label Dashboard" subtitle="Portfolio performance across your artists.">
      {loading && <p>Loading...</p>}

      {error && (
        <div className="flex items-center justify-between rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-xs text-rose-100">
          <span>Summary data unavailable: {error}</span>
          <button
            type="button"
            onClick={loadSummary}
            className="text-rose-200 underline-offset-2 hover:underline"
          >
            Retry
          </button>
        </div>
      )}

      {!loading && (
        <>
          {isLabelHome && (
            <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-white">Add Artist</h2>
                  <p className="text-sm text-white/70">
                    Submit an artist access request to add a new artist to your portfolio.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setAddArtistError(null);
                    setAddArtistSuccess(null);
                    setAddArtistOpen(true);
                  }}
                  className="rounded-full border border-white/20 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
                >
                  Add Artist
                </button>
              </div>
            </section>
          )}

          {addArtistSuccess && (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
              {addArtistSuccess}
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-4">
            <button type="button" className={cardWrapperClass}>
              <KpiCard label="Artists" value={summary.totalArtists} hint="Under this label" />
            </button>
            <button type="button" className={cardWrapperClass}>
              <KpiCard label="Active Artists" value={summary.activeArtists30d} hint="Orders in last 30 days" />
            </button>
            <button type="button" className={cardWrapperClass}>
              <KpiCard label="Inactive Artists" value={summary.inactiveArtists} hint="No orders in last 30 days" />
            </button>
            <button type="button" className={cardWrapperClass}>
              <KpiCard label="Label Gross" value={formatCurrency(summary.totalGross)} hint="All time" />
            </button>
          </div>

          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Artist Performance</h2>
              <button
                type="button"
                className="text-xs uppercase tracking-[0.3em] text-white/60 hover:text-white"
                onClick={loadSummary}
              >
                Refresh
              </button>
            </div>

            {summary.artists.length === 0 ? (
              <EmptyState
                title="No artists linked"
                description="Link artists to this label to see portfolio performance."
              />
            ) : (
              <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
                <div className="grid grid-cols-[1.8fr_1fr_1fr_1fr_1fr] gap-3 bg-white/5 px-4 py-3 text-xs uppercase tracking-[0.3em] text-neutral-400">
                  <span>Artist</span>
                  <span>Orders 30d</span>
                  <span>Gross 30d</span>
                  <span>Units 30d</span>
                  <span>Active Products</span>
                </div>
                <div className="divide-y divide-white/10">
                  {summary.artists.map((artist) => (
                    <button
                      key={artist.artistId}
                      type="button"
                      onClick={() => navigate(`/partner/label/artists/${artist.artistId}`)}
                      className="grid w-full grid-cols-[1.8fr_1fr_1fr_1fr_1fr] gap-3 px-4 py-3 text-left text-sm text-white hover:bg-white/5"
                    >
                      <span className="font-medium">{artist.artistName}</span>
                      <span>{artist.orders30d}</span>
                      <span>{formatCurrency(artist.gross30d)}</span>
                      <span>{artist.units30d}</span>
                      <span>{artist.activeProductsCount}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>
        </>
      )}

      {addArtistOpen && isLabelHome && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-slate-950 p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-white">Artist Access Request</h2>
              <button
                type="button"
                onClick={() => setAddArtistOpen(false)}
                className="rounded-full border border-white/20 px-3 py-1 text-xs uppercase tracking-[0.3em] text-white/80 hover:bg-white/10"
              >
                Close
              </button>
            </div>

            {addArtistError && (
              <div role="alert" className="mb-3 rounded-xl border border-rose-500/40 bg-rose-600/10 px-4 py-3 text-sm text-rose-100">
                {addArtistError}
              </div>
            )}

            <form className="space-y-3" onSubmit={submitArtistAccessRequest}>
              <label className="block text-sm font-medium text-white/80">
                Name *
                <input
                  className="mt-2 block w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white focus:border-white/40 focus:outline-none"
                  value={form.name}
                  onChange={handleFormChange('name')}
                />
                {formErrors.name && <p className="text-xs text-rose-300">{formErrors.name}</p>}
              </label>
              <label className="block text-sm font-medium text-white/80">
                Handle suggestion
                <input
                  className="mt-2 block w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white focus:border-white/40 focus:outline-none"
                  value={form.handleSuggestion}
                  onChange={handleFormChange('handleSuggestion')}
                />
              </label>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="block text-sm font-medium text-white/80">
                  Email
                  <input
                    type="email"
                    className="mt-2 block w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white focus:border-white/40 focus:outline-none"
                    value={form.contactEmail}
                    onChange={handleFormChange('contactEmail')}
                  />
                  {formErrors.contactEmail && (
                    <p className="text-xs text-rose-300">{formErrors.contactEmail}</p>
                  )}
                </label>
                <label className="block text-sm font-medium text-white/80">
                  Phone
                  <input
                    className="mt-2 block w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white focus:border-white/40 focus:outline-none"
                    value={form.contactPhone}
                    onChange={handleFormChange('contactPhone')}
                  />
                </label>
              </div>
              <label className="block text-sm font-medium text-white/80">
                Socials
                <input
                  className="mt-2 block w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white focus:border-white/40 focus:outline-none"
                  value={form.socials}
                  onChange={handleFormChange('socials')}
                />
              </label>
              <label className="block text-sm font-medium text-white/80">
                Pitch
                <textarea
                  rows={3}
                  className="mt-2 block w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white focus:border-white/40 focus:outline-none"
                  value={form.pitch}
                  onChange={handleFormChange('pitch')}
                />
              </label>
              <button
                type="submit"
                disabled={addArtistSubmitting}
                className="w-full rounded-full bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-white/90 disabled:opacity-60"
                aria-label="Submit request"
              >
                {addArtistSubmitting ? 'Submitting...' : 'Submit request'}
              </button>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
