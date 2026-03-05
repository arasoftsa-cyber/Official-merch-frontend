import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiFetch, apiFetchForm } from '../../shared/api/http';

type Artist = {
  id: string;
  handle?: string;
  name?: string;
};

type FieldErrors = Record<string, string>;

const COLOR_OPTIONS = ['black', 'white', 'yellow', 'maroon', 'navy_blue'] as const;
const MERCH_TYPE_OPTIONS = ['tshirt', 'hoodie', 'cap', 'poster', 'other'] as const;

const parseNumberValue = (value: string): number | null => {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return n;
};

const mapValidationDetails = (details: any[]): FieldErrors => {
  const out: FieldErrors = {};
  details.forEach((detail) => {
    const field = String(detail?.field || '').trim();
    const message = String(detail?.message || '').trim();
    if (!field || !message) return;
    if (!out[field]) out[field] = message;
  });
  return out;
};

export default function AdminCreateProductPage() {
  const navigate = useNavigate();
  const [artists, setArtists] = useState<Artist[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [artistId, setArtistId] = useState('');
  const [merchName, setMerchName] = useState('');
  const [merchStory, setMerchStory] = useState('');
  const [vendorPay, setVendorPay] = useState('');
  const [ourShare, setOurShare] = useState('');
  const [royalty, setRoyalty] = useState('');
  const [merchType, setMerchType] = useState('');
  const [selectedColors, setSelectedColors] = useState<string[]>(['black']);
  const [listingPhotos, setListingPhotos] = useState<File[]>([]);

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setSubmitError(null);
      try {
        const artistsPayload = await apiFetch('/artists');
        if (!active) return;

        const artistItems = Array.isArray(artistsPayload?.artists)
          ? artistsPayload.artists
          : Array.isArray(artistsPayload)
            ? artistsPayload
            : [];

        setArtists(artistItems);
        if (artistItems.length > 0) {
          setArtistId(String(artistItems[0].id || ''));
        }
      } catch (err: any) {
        if (!active) return;
        setSubmitError(err?.message ?? 'Failed to load artists');
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const artistOptions = useMemo(
    () =>
      artists.map((artist) => ({
        id: artist.id,
        label: artist.name || artist.handle || artist.id,
      })),
    [artists]
  );

  const toggleColor = (color: string) => {
    setSelectedColors((prev) => {
      if (prev.includes(color)) {
        if (prev.length === 1) return prev;
        return prev.filter((entry) => entry !== color);
      }
      return [...prev, color];
    });
  };

  const validate = (): FieldErrors => {
    const errors: FieldErrors = {};

    if (!artistId) errors.artist_id = 'Artist is required';
    if (merchName.trim().length < 2) errors.merch_name = 'Merch Name must be at least 2 characters';
    if (merchStory.trim().length < 10) errors.merch_story = 'Merch Story must be at least 10 characters';

    const vendor = parseNumberValue(vendorPay);
    if (vendor === null || vendor < 0) errors.vendor_pay = 'Vendor pay must be 0 or greater';

    const our = parseNumberValue(ourShare);
    if (our === null || our < 0) errors.our_share = 'Our share must be 0 or greater';

    const royaltyValue = parseNumberValue(royalty);
    if (royaltyValue === null || royaltyValue < 0) errors.royalty = 'Royalty must be 0 or greater';

    if (!merchType.trim()) errors.merch_type = 'Merch Type is required';
    if (selectedColors.length < 1) errors.colors = 'Select at least one color';
    if (listingPhotos.length !== 4) errors.listing_photos = 'Exactly 4 listing photos are required';

    return errors;
  };

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitError(null);

    const validationErrors = validate();
    setFieldErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      setSubmitError('Please fix the highlighted fields.');
      return;
    }

    const fd = new FormData();
    fd.append('artist_id', artistId);
    fd.append('artistId', artistId);
    fd.append('title', merchName.trim());
    fd.append('merchName', merchName.trim());
    fd.append('description', merchStory.trim());
    fd.append('merchStory', merchStory.trim());
    fd.append('is_active', 'false');
    fd.append('status', 'inactive');
    fd.append('merch_name', merchName.trim());
    fd.append('merch_story', merchStory.trim());
    fd.append('vendor_pay', vendorPay.trim());
    fd.append('our_share', ourShare.trim());
    fd.append('royalty', royalty.trim());
    fd.append('merch_type', merchType.trim());
    fd.append('colors', JSON.stringify(selectedColors));
    listingPhotos.forEach((file) => {
      fd.append('photos', file);
    });

    setSubmitting(true);
    try {
      await apiFetchForm('/admin/products', fd, {
        method: 'POST',
      });

      navigate('/partner/admin/products');
    } catch (err: any) {
      const details = Array.isArray(err?.details) ? err.details : [];
      if (details.length > 0) {
        const mapped = mapValidationDetails(details);
        setFieldErrors((prev) => ({ ...prev, ...mapped }));
      }
      setSubmitError(err?.message ?? 'Failed to create product');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 dark:text-slate-500">Admin Control</p>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white">Create Product</h1>
        </div>
        <Link className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-white transition-all border border-slate-200 dark:border-white/10 px-4 py-1.5 rounded-full" to="/partner/admin/products">
          Back to items
        </Link>
      </div>

      {submitError && (
        <div className="rounded-xl border border-rose-200 dark:border-rose-400/40 bg-rose-50 dark:bg-rose-500/10 px-4 py-3 text-sm font-bold text-rose-600 dark:text-rose-400">
          {submitError}
        </div>
      )}

      <form
        onSubmit={onSubmit}
        className="grid gap-6 rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 p-8 md:grid-cols-2 shadow-sm"
      >
        <label htmlFor="admin-product-artist" className="block space-y-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Artist</span>
          <select
            id="admin-product-artist"
            data-testid="admin-product-artist"
            value={artistId}
            onChange={(event) => setArtistId(event.target.value)}
            disabled={loading || submitting}
            className="w-full rounded-xl border border-slate-200 dark:border-white/15 bg-white dark:bg-black/30 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-indigo-500 dark:focus:border-white/40 transition outline-none appearance-none"
          >
            <option value="" className="bg-white dark:bg-slate-900">Select artist</option>
            {artistOptions.map((artist) => (
              <option key={artist.id} value={artist.id} className="bg-white dark:bg-slate-900">
                {artist.label}
              </option>
            ))}
          </select>
          {fieldErrors.artist_id && <p className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-tight">{fieldErrors.artist_id}</p>}
        </label>

        <label className="block space-y-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Merch Name</span>
          <input
            data-testid="admin-product-merch-name"
            value={merchName}
            onChange={(event) => setMerchName(event.target.value)}
            disabled={submitting}
            placeholder="e.g. Vintage Rock Tee"
            className="w-full rounded-xl border border-slate-200 dark:border-white/15 bg-white dark:bg-black/30 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-indigo-500 dark:focus:border-white/40 transition outline-none"
          />
          {fieldErrors.merch_name && <p className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-tight">{fieldErrors.merch_name}</p>}
        </label>

        <label className="block space-y-2 md:col-span-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Merch Story</span>
          <textarea
            value={merchStory}
            onChange={(event) => setMerchStory(event.target.value)}
            rows={4}
            disabled={submitting}
            placeholder="Describe the product and its backstory..."
            className="w-full rounded-xl border border-slate-200 dark:border-white/15 bg-white dark:bg-black/30 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-indigo-500 dark:focus:border-white/40 transition outline-none"
          />
          {fieldErrors.merch_story && <p className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-tight">{fieldErrors.merch_story}</p>}
        </label>

        <div className="grid grid-cols-3 gap-4 md:col-span-2">
          <label className="block space-y-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Vendor Pay</span>
            <input
              data-testid="admin-product-vendor-pay"
              type="number"
              min={0}
              step="0.01"
              value={vendorPay}
              onChange={(event) => setVendorPay(event.target.value)}
              disabled={submitting}
              className="w-full rounded-xl border border-slate-200 dark:border-white/15 bg-white dark:bg-black/30 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-indigo-500 dark:focus:border-white/40 transition outline-none"
            />
            {(fieldErrors.vendor_pay || fieldErrors.vendor_pay_cents) && (
              <p className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-tight">{fieldErrors.vendor_pay || fieldErrors.vendor_pay_cents}</p>
            )}
          </label>

          <label className="block space-y-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Our Share</span>
            <input
              data-testid="admin-product-our-share"
              type="number"
              min={0}
              step="0.01"
              value={ourShare}
              onChange={(event) => setOurShare(event.target.value)}
              disabled={submitting}
              className="w-full rounded-xl border border-slate-200 dark:border-white/15 bg-white dark:bg-black/30 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-indigo-500 dark:focus:border-white/40 transition outline-none"
            />
            {(fieldErrors.our_share || fieldErrors.our_share_cents) && (
              <p className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-tight">{fieldErrors.our_share || fieldErrors.our_share_cents}</p>
            )}
          </label>

          <label className="block space-y-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Royalty</span>
            <input
              data-testid="admin-product-royalty"
              type="number"
              min={0}
              step="0.01"
              value={royalty}
              onChange={(event) => setRoyalty(event.target.value)}
              disabled={submitting}
              className="w-full rounded-xl border border-slate-200 dark:border-white/15 bg-white dark:bg-black/30 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-indigo-500 dark:focus:border-white/40 transition outline-none"
            />
            {(fieldErrors.royalty || fieldErrors.royalty_cents) && (
              <p className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-tight">{fieldErrors.royalty || fieldErrors.royalty_cents}</p>
            )}
          </label>
        </div>

        <label className="block space-y-2 font-medium">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Merch Type</span>
          <select
            data-testid="admin-product-merch-type"
            value={merchType}
            onChange={(event) => setMerchType(event.target.value)}
            disabled={submitting}
            className="w-full rounded-xl border border-slate-200 dark:border-white/15 bg-white dark:bg-black/30 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-indigo-500 dark:focus:border-white/40 transition outline-none appearance-none"
          >
            <option value="" className="bg-white dark:bg-slate-900">Select type</option>
            {MERCH_TYPE_OPTIONS.map((entry) => (
              <option key={entry} value={entry} className="bg-white dark:bg-slate-900">
                {entry}
              </option>
            ))}
          </select>
          {fieldErrors.merch_type && <p className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-tight">{fieldErrors.merch_type}</p>}
        </label>

        <label className="block space-y-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Initial Status</span>
          <input
            value="Inactive"
            readOnly
            disabled
            className="w-full rounded-xl border border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-black/60 px-3 py-2 text-sm font-black uppercase tracking-widest text-slate-400 dark:text-slate-600 cursor-not-allowed"
          />
        </label>

        <fieldset className="rounded-2xl border border-slate-200 dark:border-white/10 p-5 md:col-span-2 bg-slate-50/30 dark:bg-transparent">
          <legend className="px-3 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Available Colors</legend>
          <div className="flex flex-wrap gap-x-8 gap-y-4">
            {COLOR_OPTIONS.map((color) => (
              <label key={color} className="flex items-center gap-2.5 text-sm font-medium text-slate-700 dark:text-slate-100 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={selectedColors.includes(color)}
                  onChange={() => toggleColor(color)}
                  disabled={submitting}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 transition-all"
                />
                <span className="group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors capitalize">{color.replace('_', ' ')}</span>
              </label>
            ))}
          </div>
          {fieldErrors.colors && <p className="mt-4 text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-tight">{fieldErrors.colors}</p>}
        </fieldset>

        <label className="block space-y-2 md:col-span-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Listing Photos (exactly 4)</span>
          <div className="relative group">
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(event) => {
                const files = Array.from(event.target.files || []);
                setListingPhotos(files);
                setFieldErrors((prev) => ({
                  ...prev,
                  listing_photos: files.length === 4 ? '' : 'Exactly 4 listing photos are required',
                  photos: files.length === 4 ? '' : 'Exactly 4 listing photos are required',
                }));
              }}
              disabled={submitting}
              className="w-full rounded-xl border border-dashed border-slate-200 dark:border-white/20 bg-slate-50 dark:bg-black/30 px-3 py-8 text-sm text-slate-500 dark:text-slate-400 focus:border-indigo-500 dark:focus:border-white/40 transition outline-none cursor-pointer text-center file:hidden"
            />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 group-hover:text-indigo-500 transition-colors">
                {listingPhotos.length > 0 ? `${listingPhotos.length} / 4 Photos Selected` : 'Click to upload 4 photos'}
              </span>
            </div>
          </div>
          {(fieldErrors.listing_photos || fieldErrors.photos) && (
            <p className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-tight">{fieldErrors.listing_photos || fieldErrors.photos}</p>
          )}
        </label>

        <div className="flex flex-wrap items-center justify-between gap-4 md:col-span-2 pt-6 border-t border-slate-100 dark:border-white/5">
          <button
            type="submit"
            disabled={submitting || loading || listingPhotos.length !== 4}
            className="rounded-full bg-slate-900 dark:bg-white px-10 py-3 text-xs font-black uppercase tracking-widest text-white dark:text-slate-950 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-slate-900/10 dark:shadow-none"
          >
            {submitting ? 'Creating...' : 'Launch Product'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/partner/admin/products')}
            className="rounded-full border border-slate-200 dark:border-white/10 bg-white dark:bg-transparent px-10 py-3 text-xs font-black uppercase tracking-widest text-slate-500 dark:text-white hover:bg-slate-50 dark:hover:bg-white/5 transition-all"
          >
            Discard
          </button>
        </div>
      </form>
    </main>
  );
}
