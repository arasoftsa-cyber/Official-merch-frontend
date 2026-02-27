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
          <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Admin</p>
          <h1 className="text-2xl font-semibold text-white">Create Product</h1>
        </div>
        <Link className="text-sm text-slate-300 underline" to="/partner/admin/products">
          Back to products
        </Link>
      </div>

      {submitError && <p className="text-sm text-rose-300">{submitError}</p>}

      <form
        onSubmit={onSubmit}
        className="grid gap-4 rounded-2xl border border-white/10 bg-white/5 p-4 md:grid-cols-2"
      >
        <label htmlFor="admin-product-artist" className="text-sm text-white">
          Artist
          <select
            id="admin-product-artist"
            data-testid="admin-product-artist"
            value={artistId}
            onChange={(event) => setArtistId(event.target.value)}
            disabled={loading || submitting}
            className="mt-2 w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-sm text-white"
          >
            <option value="">Select artist</option>
            {artistOptions.map((artist) => (
              <option key={artist.id} value={artist.id}>
                {artist.label}
              </option>
            ))}
          </select>
          {fieldErrors.artist_id && <p className="mt-1 text-xs text-rose-300">{fieldErrors.artist_id}</p>}
        </label>

        <label className="text-sm text-white">
          Merch Name
          <input
            data-testid="admin-product-merch-name"
            value={merchName}
            onChange={(event) => setMerchName(event.target.value)}
            disabled={submitting}
            className="mt-2 w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-sm text-white"
          />
          {fieldErrors.merch_name && <p className="mt-1 text-xs text-rose-300">{fieldErrors.merch_name}</p>}
        </label>

        <label className="text-sm text-white md:col-span-2">
          Merch Story
          <textarea
            value={merchStory}
            onChange={(event) => setMerchStory(event.target.value)}
            rows={4}
            disabled={submitting}
            className="mt-2 w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-sm text-white"
          />
          {fieldErrors.merch_story && <p className="mt-1 text-xs text-rose-300">{fieldErrors.merch_story}</p>}
        </label>

        <label className="text-sm text-white">
          To Be Paid To Vendor
          <input
            data-testid="admin-product-vendor-pay"
            type="number"
            min={0}
            step="0.01"
            value={vendorPay}
            onChange={(event) => setVendorPay(event.target.value)}
            disabled={submitting}
            className="mt-2 w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-sm text-white"
          />
          {(fieldErrors.vendor_pay || fieldErrors.vendor_pay_cents) && (
            <p className="mt-1 text-xs text-rose-300">{fieldErrors.vendor_pay || fieldErrors.vendor_pay_cents}</p>
          )}
        </label>

        <label className="text-sm text-white">
          Our Share
          <input
            data-testid="admin-product-our-share"
            type="number"
            min={0}
            step="0.01"
            value={ourShare}
            onChange={(event) => setOurShare(event.target.value)}
            disabled={submitting}
            className="mt-2 w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-sm text-white"
          />
          {(fieldErrors.our_share || fieldErrors.our_share_cents) && (
            <p className="mt-1 text-xs text-rose-300">{fieldErrors.our_share || fieldErrors.our_share_cents}</p>
          )}
        </label>

        <label className="text-sm text-white">
          Royalty
          <input
            data-testid="admin-product-royalty"
            type="number"
            min={0}
            step="0.01"
            value={royalty}
            onChange={(event) => setRoyalty(event.target.value)}
            disabled={submitting}
            className="mt-2 w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-sm text-white"
          />
          {(fieldErrors.royalty || fieldErrors.royalty_cents) && (
            <p className="mt-1 text-xs text-rose-300">{fieldErrors.royalty || fieldErrors.royalty_cents}</p>
          )}
        </label>

        <label className="text-sm text-white">
          Merch Type
          <select
            data-testid="admin-product-merch-type"
            value={merchType}
            onChange={(event) => setMerchType(event.target.value)}
            disabled={submitting}
            className="mt-2 w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-sm text-white"
          >
            <option value="">Select merch type</option>
            {MERCH_TYPE_OPTIONS.map((entry) => (
              <option key={entry} value={entry}>
                {entry}
              </option>
            ))}
          </select>
          {fieldErrors.merch_type && <p className="mt-1 text-xs text-rose-300">{fieldErrors.merch_type}</p>}
        </label>

        <label className="text-sm text-white">
          Status
          <input
            value="Inactive"
            readOnly
            disabled
            className="mt-2 w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-slate-300"
          />
        </label>

        <fieldset className="rounded-xl border border-white/10 p-3 md:col-span-2">
          <legend className="px-2 text-sm text-white">Colors</legend>
          <div className="mt-2 flex flex-wrap gap-4">
            {COLOR_OPTIONS.map((color) => (
              <label key={color} className="flex items-center gap-2 text-sm text-slate-100">
                <input
                  type="checkbox"
                  checked={selectedColors.includes(color)}
                  onChange={() => toggleColor(color)}
                  disabled={submitting}
                />
                {color}
              </label>
            ))}
          </div>
          {fieldErrors.colors && <p className="mt-2 text-xs text-rose-300">{fieldErrors.colors}</p>}
        </fieldset>

        <label className="text-sm text-white md:col-span-2">
          Listing Photos (exactly 4)
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
            className="mt-2 block w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-sm text-white"
          />
          <p className="mt-1 text-xs text-slate-300">{listingPhotos.length} selected</p>
          {(fieldErrors.listing_photos || fieldErrors.photos) && (
            <p className="mt-1 text-xs text-rose-300">{fieldErrors.listing_photos || fieldErrors.photos}</p>
          )}
        </label>

        <div className="flex gap-2 md:col-span-2">
          <button
            type="submit"
            disabled={submitting || loading || listingPhotos.length !== 4}
            className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            {submitting ? 'Creating...' : 'Create Product'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/partner/admin/products')}
            className="rounded-xl border border-white/20 px-4 py-2 text-sm text-white"
          >
            Cancel
          </button>
        </div>
      </form>
    </main>
  );
}
