import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import AppShell from '../../components/layout/AppShell';
import ErrorBanner from '../../components/ux/ErrorBanner';
import LoadingSkeleton from '../../components/ux/LoadingSkeleton';
import { useToast } from '../../components/ux/ToastHost';
import { apiFetch, apiFetchForm } from '../../shared/api/http';
import { resolveMediaUrl } from '../../shared/utils/media';

type BannerRow = {
  link_id: string;
  media_asset_id: string;
  public_url: string;
  sort_order: number;
};

const normalizeBanners = (payload: any): BannerRow[] => {
  const items = Array.isArray(payload?.banners)
    ? payload.banners
    : Array.isArray(payload?.items)
    ? payload.items
    : Array.isArray(payload)
    ? payload
    : [];

  return items
    .map((item: any) => {
      const linkId = String(item?.link_id ?? item?.linkId ?? '').trim();
      const mediaAssetId = String(item?.media_asset_id ?? item?.mediaAssetId ?? '').trim();
      const publicUrl = String(item?.public_url ?? item?.publicUrl ?? '').trim();
      const sortOrderRaw = Number(item?.sort_order ?? item?.sortOrder ?? 0);
      if (!linkId || !mediaAssetId || !publicUrl || !Number.isFinite(sortOrderRaw)) {
        return null;
      }
      return {
        link_id: linkId,
        media_asset_id: mediaAssetId,
        public_url: publicUrl,
        sort_order: Math.trunc(sortOrderRaw),
      } as BannerRow;
    })
    .filter((row: BannerRow | null): row is BannerRow => Boolean(row));
};

const parseInteger = (value: string): number | null => {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isInteger(n)) return null;
  return n;
};

export default function AdminHomepageBannersPage() {
  const { notify } = useToast();
  const uploadInputRef = useRef<HTMLInputElement | null>(null);

  const [banners, setBanners] = useState<BannerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const [sortInputById, setSortInputById] = useState<Record<string, string>>({});
  const [savingSortById, setSavingSortById] = useState<Record<string, boolean>>({});
  const [deletingById, setDeletingById] = useState<Record<string, boolean>>({});

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await apiFetch('/admin/homepage/banners');
      const rows = normalizeBanners(payload);
      setBanners(rows);
      setSortInputById(
        rows.reduce<Record<string, string>>((acc, row) => {
          acc[row.link_id] = String(row.sort_order);
          return acc;
        }, {})
      );
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load homepage banners');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const isUploadingDisabled = useMemo(
    () => uploading || !uploadFile,
    [uploadFile, uploading]
  );

  const onClickPickImage = () => {
    uploadInputRef.current?.click();
  };

  const onUpload = async () => {
    if (!uploadFile) {
      notify('Select an image first.', 'error');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('image', uploadFile);
      await apiFetchForm('/admin/homepage/banners/upload', formData, { method: 'POST' });
      notify('Banner uploaded.', 'success');
      setUploadFile(null);
      if (uploadInputRef.current) {
        uploadInputRef.current.value = '';
      }
      await load();
    } catch (err: any) {
      notify(err?.message ?? 'Upload failed', 'error');
    } finally {
      setUploading(false);
    }
  };

  const saveSortOrder = async (row: BannerRow) => {
    const raw = sortInputById[row.link_id] ?? '';
    const parsed = parseInteger(raw);
    if (parsed === null) {
      notify('Sort order must be an integer.', 'error');
      return;
    }
    if (parsed === row.sort_order) {
      notify('No sort-order changes to save.', 'info');
      return;
    }

    setSavingSortById((prev) => ({ ...prev, [row.link_id]: true }));
    try {
      await apiFetch(`/admin/homepage/banners/${row.link_id}`, {
        method: 'PATCH',
        body: { sort_order: parsed },
      });
      notify('Sort order updated.', 'success');
      await load();
    } catch (err: any) {
      notify(err?.message ?? 'Failed to update sort order', 'error');
    } finally {
      setSavingSortById((prev) => ({ ...prev, [row.link_id]: false }));
    }
  };

  const deleteBanner = async (row: BannerRow) => {
    const ok = window.confirm('Delete this banner link?');
    if (!ok) return;

    setDeletingById((prev) => ({ ...prev, [row.link_id]: true }));
    try {
      await apiFetch(`/admin/homepage/banners/${row.link_id}`, {
        method: 'DELETE',
      });
      notify('Banner deleted.', 'success');
      await load();
    } catch (err: any) {
      notify(err?.message ?? 'Failed to delete banner', 'error');
    } finally {
      setDeletingById((prev) => ({ ...prev, [row.link_id]: false }));
    }
  };

  return (
    <AppShell title="Homepage Banners" subtitle="Manage hero carousel banners for the landing page.">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link className="text-sm text-slate-300 underline" to="/partner/admin">
          Back to admin dashboard
        </Link>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="rounded-xl border border-white/20 px-4 py-2 text-xs uppercase tracking-[0.25em] text-white disabled:opacity-60"
        >
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={uploadInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              setUploadFile(file);
            }}
          />
          <button
            type="button"
            onClick={onClickPickImage}
            className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-xs uppercase tracking-[0.25em] text-white hover:bg-white/20"
          >
            Choose Image
          </button>
          <button
            type="button"
            onClick={onUpload}
            disabled={isUploadingDisabled}
            className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-xs uppercase tracking-[0.25em] text-white hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {uploading ? 'Uploading...' : 'Upload Banner'}
          </button>
          <p className="text-sm text-slate-300">
            {uploadFile ? uploadFile.name : 'No file selected'}
          </p>
        </div>
      </section>

      {loading && <LoadingSkeleton count={2} />}
      {error && <ErrorBanner message={error} onRetry={load} />}

      {!loading && !error && banners.length === 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-slate-300">
          No homepage banners yet. Upload one to get started.
        </div>
      )}

      {!loading && !error && banners.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
          <div className="grid grid-cols-[120px_1fr_180px_220px] gap-3 border-b border-white/10 px-4 py-3 text-xs uppercase tracking-[0.25em] text-slate-400">
            <span>Preview</span>
            <span>Public URL</span>
            <span>Sort Order</span>
            <span>Actions</span>
          </div>
          <div className="divide-y divide-white/10">
            {banners.map((row) => {
              const previewUrl = resolveMediaUrl(row.public_url) || row.public_url;
              const sortRaw = sortInputById[row.link_id] ?? String(row.sort_order);
              const parsed = parseInteger(sortRaw);
              const hasChange = parsed !== null && parsed !== row.sort_order;
              const invalidSort = sortRaw.trim().length > 0 && parsed === null;
              const saving = Boolean(savingSortById[row.link_id]);
              const deleting = Boolean(deletingById[row.link_id]);

              return (
                <div
                  key={row.link_id}
                  className="grid grid-cols-[120px_1fr_180px_220px] gap-3 px-4 py-3 text-sm text-white"
                >
                  <div className="h-16 w-28 overflow-hidden rounded-lg border border-white/15 bg-black/20">
                    <img
                      src={previewUrl}
                      alt={`Homepage banner ${row.link_id}`}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm text-white">{row.public_url}</p>
                    <p className="mt-1 font-mono text-xs text-slate-400">
                      link: {row.link_id}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <input
                      type="number"
                      value={sortRaw}
                      onChange={(event) =>
                        setSortInputById((prev) => ({
                          ...prev,
                          [row.link_id]: event.target.value,
                        }))
                      }
                      className="w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
                    />
                    {invalidSort && (
                      <p className="text-xs text-rose-300">Enter a whole number.</p>
                    )}
                  </div>
                  <div className="flex items-start gap-2">
                    <button
                      type="button"
                      onClick={() => saveSortOrder(row)}
                      disabled={saving || deleting || !hasChange || invalidSort}
                      className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs uppercase tracking-[0.22em] text-white hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteBanner(row)}
                      disabled={saving || deleting}
                      className="rounded-xl border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-xs uppercase tracking-[0.22em] text-rose-100 hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {deleting ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </AppShell>
  );
}
