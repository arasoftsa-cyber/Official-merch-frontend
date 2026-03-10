import React, { useEffect, useMemo, useRef, useState } from 'react';
import AppShell from '../../../shared/components/layout/AppShell';
import ErrorBanner from '../../../shared/components/ux/ErrorBanner';
import LoadingSkeleton from '../../../shared/components/ux/LoadingSkeleton';
import { apiFetch, apiFetchForm } from '../../../shared/api/http';

const ADMIN_DROPS_BASE = '/api/admin/drops';
const MAX_HERO_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_HERO_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

type AdminFetchResult<T> = {
  ok: boolean;
  status: number;
  data?: T;
  errText?: string;
};

const normalizeAdminFetchError = (rawMessage: unknown, statusCode: number) => {
  const message = String(rawMessage ?? '').trim();
  if (!message) {
    return statusCode > 0 ? `HTTP_${statusCode}` : 'Request failed';
  }

  const looksLikeHtml =
    /<!doctype html/i.test(message) ||
    /<html[\s>]/i.test(message) ||
    /<\/?[a-z][\s\S]*>/i.test(message);
  const isRouteMiss = /\bcannot\s+(get|post|put|patch|delete)\b/i.test(message);
  if (looksLikeHtml || isRouteMiss) {
    return statusCode === 404
      ? 'Admin drops endpoint is unavailable.'
      : `Unexpected server response (HTTP_${statusCode || 0})`;
  }

  return message;
};

async function adminFetch<T>(
  path: string,
  init?: RequestInit
): Promise<AdminFetchResult<T>> {
  try {
    // apiFetch keeps existing auth behavior by attaching Authorization from tokenStore.
    const data = await apiFetch(path, init);
    return { ok: true, status: 200, data: data as T };
  } catch (err: any) {
    const status = Number(err?.status ?? 0);
    return {
      ok: false,
      status,
      errText: normalizeAdminFetchError(err?.message ?? 'Request failed', status),
    };
  }
}

type DropRow = {
  id: string;
  handle?: string;
  title: string;
  status: string;
  artistId?: string;
  artistName?: string;
  description?: string | null;
  heroImageUrl?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  quizJson?: any;
  mappedProductsCount?: number | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type ArtistOption = {
  id: string;
  name: string;
};

type ProductOption = {
  id: string;
  title: string;
  artistId?: string;
};

const normalizeDrop = (raw: any): DropRow | null => {
  const id = raw?.id;
  const title = raw?.title;
  if (!id || !title) return null;
  return {
    id: String(id),
    handle: raw?.handle ? String(raw.handle) : undefined,
    title: String(title),
    status: String(raw?.status ?? 'draft'),
    artistId: raw?.artistId ?? raw?.artist_id ?? null,
    artistName: raw?.artistName ?? raw?.artist_name ?? null,
    description: raw?.description ?? null,
    heroImageUrl: raw?.heroImageUrl ?? raw?.hero_image_url ?? null,
    startsAt: raw?.startsAt ?? raw?.starts_at ?? null,
    endsAt: raw?.endsAt ?? raw?.ends_at ?? null,
    quizJson: raw?.quizJson ?? raw?.quiz_json ?? null,
    mappedProductsCount:
      typeof raw?.mappedProductsCount === 'number'
        ? raw.mappedProductsCount
        : typeof raw?.mapped_products_count === 'number'
          ? raw.mapped_products_count
          : null,
    createdAt: raw?.createdAt ?? raw?.created_at ?? null,
    updatedAt: raw?.updatedAt ?? raw?.updated_at ?? null,
  };
};

const formatDateTime = (value?: string | null) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
};

export default function AdminDropsPage() {
  const [rows, setRows] = useState<DropRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [artists, setArtists] = useState<ArtistOption[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [mappedCountByDropId, setMappedCountByDropId] = useState<Record<string, number>>({});
  const [title, setTitle] = useState('');
  const [selectedArtistId, setSelectedArtistId] = useState('');
  const [creating, setCreating] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [editorDrop, setEditorDrop] = useState<DropRow | null>(null);
  const [editorTitle, setEditorTitle] = useState('');
  const [editorHandle, setEditorHandle] = useState('');
  const [editorDescription, setEditorDescription] = useState('');
  const [editorHeroImageUrl, setEditorHeroImageUrl] = useState('');
  const [editorStartsAt, setEditorStartsAt] = useState('');
  const [editorEndsAt, setEditorEndsAt] = useState('');
  const [editorQuizJson, setEditorQuizJson] = useState('');
  const [editorSelectedProductIds, setEditorSelectedProductIds] = useState<string[]>([]);
  const [editorInitialProductIds, setEditorInitialProductIds] = useState<string[]>([]);
  const [editorLoading, setEditorLoading] = useState(false);
  const [editorSaving, setEditorSaving] = useState(false);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [heroUploadBusy, setHeroUploadBusy] = useState(false);
  const [heroUploadStatus, setHeroUploadStatus] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);
  const editorTitleInputRef = useRef<HTMLInputElement | null>(null);
  const heroUploadInputRef = useRef<HTMLInputElement | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [dropsResult, artistsPayload, productsPayload] = await Promise.all([
        adminFetch<any>(ADMIN_DROPS_BASE),
        apiFetch('/api/artists'),
        apiFetch('/api/admin/products').catch(() => ({ items: [] })),
      ]);
      if (!dropsResult.ok) {
        throw new Error(dropsResult.errText ?? `HTTP_${dropsResult.status}`);
      }
      const dropsPayload = dropsResult.data;

      const dropItems = Array.isArray(dropsPayload?.items)
        ? dropsPayload.items
        : Array.isArray(dropsPayload)
          ? dropsPayload
          : [];
      const artistItems = Array.isArray(artistsPayload?.artists)
        ? artistsPayload.artists
        : Array.isArray(artistsPayload?.items)
          ? artistsPayload.items
          : [];
      const productItems = Array.isArray(productsPayload?.items)
        ? productsPayload.items
        : Array.isArray(productsPayload)
          ? productsPayload
          : [];

      const normalizedDrops = dropItems
        .map(normalizeDrop)
        .filter((item: DropRow | null): item is DropRow => Boolean(item));
      const normalizedArtists = artistItems
        .map((artist: any) => {
          const id = artist?.id;
          if (!id) return null;
          return {
            id: String(id),
            name: String(artist?.name ?? artist?.handle ?? id),
          };
        })
        .filter((item: ArtistOption | null): item is ArtistOption => Boolean(item));
      const normalizedProducts = productItems
        .map((product: any) => {
          const id = product?.id;
          if (!id) return null;
          return {
            id: String(id),
            title: String(product?.title ?? id),
            artistId: product?.artistId ?? product?.artist_id ?? undefined,
          };
        })
        .filter((item: ProductOption | null): item is ProductOption => Boolean(item));

      const artistNameById = new Map(normalizedArtists.map((artist: ArtistOption) => [artist.id, artist.name]));
      const rowsWithArtistNames = normalizedDrops.map((drop: DropRow) => ({
        ...drop,
        artistName: drop.artistName ?? (drop.artistId ? artistNameById.get(drop.artistId) : null) ?? undefined,
      }));

      setRows(rowsWithArtistNames);
      setArtists(normalizedArtists);
      setProducts(normalizedProducts);
      setSelectedArtistId((prev) => prev || normalizedArtists[0]?.id || '');
      setMappedCountByDropId((prev) => {
        const next = { ...prev };
        rowsWithArtistNames.forEach((row: DropRow) => {
          if (typeof row.mappedProductsCount === 'number') {
            next[row.id] = row.mappedProductsCount;
          }
        });
        return next;
      });
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load drops');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!openMenuId) return;

    const onMouseDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest(`[data-drop-menu-root="${openMenuId}"]`)) return;
      setOpenMenuId(null);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenMenuId(null);
      }
    };

    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [openMenuId]);

  useEffect(() => {
    if (!editorDrop) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeEditor();
      }
    };
    document.addEventListener('keydown', onKeyDown);

    const focusTimer = window.setTimeout(() => {
      editorTitleInputRef.current?.focus();
    }, 0);

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [editorDrop]);

  const canCreate = useMemo(
    () => !creating && title.trim().length > 0 && selectedArtistId.trim().length > 0,
    [creating, title, selectedArtistId]
  );

  const createDrop = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canCreate) return;

    const chosenArtistId = selectedArtistId.trim();
    if (!chosenArtistId) {
      setError('No artist available for drop creation');
      return;
    }

    setCreating(true);
    setError(null);
    setNotice(null);
    try {
      const titleValue = title.trim();

      const createBody = {
        title: titleValue,
        artistId: chosenArtistId,
        artist_id: chosenArtistId,
      };
      const createResult = await adminFetch<any>(ADMIN_DROPS_BASE, {
        method: 'POST',
        body: JSON.stringify(createBody) as any,
      });
      if (!createResult.ok) {
        throw new Error(createResult.errText ?? `HTTP_${createResult.status}`);
      }
      const payload = createResult.data;

      const created = normalizeDrop(payload?.drop ?? payload);
      if (created) {
        const artistName =
          artists.find((artist) => artist.id === chosenArtistId)?.name ?? chosenArtistId;
        setRows((prev) => [
          { ...created, artistId: chosenArtistId, artistName },
          ...prev.filter((row) => row.id !== created.id),
        ]);
        setNotice({ type: 'success', text: 'Drop created.' });
      }
      setTitle('');
    } catch (err: any) {
      setError(err?.message ?? 'Failed to create drop');
    } finally {
      setCreating(false);
    }
  };

  const runLifecycleAction = async (
    row: DropRow,
    action: 'publish' | 'unpublish' | 'archive'
  ) => {
    if (!row.handle) {
      setNotice({ type: 'error', text: 'Drop handle missing; cannot run action.' });
      return;
    }
    setActionLoadingId(row.id);
    setOpenMenuId(null);
    setNotice(null);
    try {
      if (action === 'publish') {
        const mappedCount = mappedCountByDropId[row.id];
        if (mappedCount === 0) {
          setNotice({ type: 'error', text: 'Attach products to publish.' });
          return;
        }
      }
      const dropKey = getDropPathKey(row);
      const lifecycleResult = await adminFetch(
        `${ADMIN_DROPS_BASE}/${encodeURIComponent(dropKey)}/${action}`,
        {
          method: 'POST',
        }
      );
      if (!lifecycleResult.ok) {
        throw new Error(lifecycleResult.errText ?? `HTTP_${lifecycleResult.status}`);
      }
      setNotice({ type: 'success', text: `Drop ${action}ed.` });
      await load();
    } catch (err: any) {
      setNotice({ type: 'error', text: err?.message ?? `Failed to ${action} drop` });
    } finally {
      setActionLoadingId(null);
    }
  };

  const closeEditor = () => {
    setEditorDrop(null);
    setEditorTitle('');
    setEditorHandle('');
    setEditorDescription('');
    setEditorHeroImageUrl('');
    setEditorStartsAt('');
    setEditorEndsAt('');
    setEditorQuizJson('');
    setEditorSelectedProductIds([]);
    setEditorInitialProductIds([]);
    setEditorError(null);
    setEditorLoading(false);
    setEditorSaving(false);
    setHeroUploadBusy(false);
    setHeroUploadStatus(null);
    if (heroUploadInputRef.current) {
      heroUploadInputRef.current.value = '';
    }
  };

  const getDropPathKey = (row: DropRow) => row.handle || row.id;

  const openEditor = async (row: DropRow) => {
    setEditorDrop(row);
    setEditorTitle(row.title ?? '');
    setEditorHandle(row.handle ?? '');
    setEditorDescription(row.description ?? '');
    setEditorHeroImageUrl(row.heroImageUrl ?? '');
    setEditorStartsAt(row.startsAt ? String(row.startsAt).slice(0, 16) : '');
    setEditorEndsAt(row.endsAt ? String(row.endsAt).slice(0, 16) : '');
    setEditorQuizJson(
      row.quizJson ? JSON.stringify(row.quizJson, null, 2) : ''
    );
    setEditorSelectedProductIds([]);
    setEditorInitialProductIds([]);
    setEditorError(null);
    setHeroUploadStatus(null);
    setEditorLoading(true);

    try {
      const productResult = await adminFetch<any>(
        `${ADMIN_DROPS_BASE}/${encodeURIComponent(row.id)}/products`
      );
      if (!productResult.ok) {
        throw Object.assign(new Error(productResult.errText ?? `HTTP_${productResult.status}`), {
          status: productResult.status,
        });
      }
      const mappedIds = Array.isArray(productResult.data?.product_ids)
        ? productResult.data.product_ids
          .map((value: any) => String(value || '').trim())
          .filter(Boolean)
        : [];

      setEditorInitialProductIds(mappedIds);
      setEditorSelectedProductIds(mappedIds);
      setMappedCountByDropId((prev) => ({
        ...prev,
        [row.id]: mappedIds.length,
      }));
    } catch (err: any) {
      const statusPart = err?.status ? `HTTP_${err.status}: ` : '';
      setEditorError(`${statusPart}${err?.message ?? 'Unable to load mapped products for this drop.'}`);
    } finally {
      setEditorLoading(false);
    }
  };

  const uploadHeroImage = async (file: File | null) => {
    if (!editorDrop) return;
    if (!file) {
      setHeroUploadStatus({ type: 'error', text: 'Select an image first.' });
      return;
    }

    if (file.size > MAX_HERO_IMAGE_BYTES) {
      setHeroUploadStatus({ type: 'error', text: 'Image must be 5MB or smaller.' });
      return;
    }

    if (!ALLOWED_HERO_IMAGE_MIME_TYPES.has(String(file.type || '').toLowerCase())) {
      setHeroUploadStatus({ type: 'error', text: 'Only JPG, PNG, or WEBP images are allowed.' });
      return;
    }

    const dropId = editorDrop.id;
    setHeroUploadBusy(true);
    setHeroUploadStatus({ type: 'info', text: 'Uploading hero image...' });
    setEditorError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const payload = await apiFetchForm(
        `${ADMIN_DROPS_BASE}/${encodeURIComponent(dropId)}/hero-image`,
        formData,
        { method: 'POST' }
      );

      const uploadedUrl = String(
        payload?.heroImageUrl ??
        payload?.public_url ??
        payload?.publicUrl ??
        payload?.drop?.heroImageUrl ??
        payload?.drop?.hero_image_url ??
        ''
      ).trim();

      if (!uploadedUrl) {
        throw new Error('Upload succeeded but no hero image URL was returned.');
      }

      setEditorHeroImageUrl(uploadedUrl);
      setHeroUploadStatus({ type: 'success', text: 'Hero image uploaded.' });
      setRows((prev) =>
        prev.map((row) =>
          row.id === dropId
            ? {
              ...row,
              heroImageUrl: uploadedUrl,
            }
            : row
        )
      );
    } catch (err: any) {
      setHeroUploadStatus({
        type: 'error',
        text: err?.message ?? 'Failed to upload hero image.',
      });
    } finally {
      setHeroUploadBusy(false);
      if (heroUploadInputRef.current) {
        heroUploadInputRef.current.value = '';
      }
    }
  };

  const saveEditor = async () => {
    if (!editorDrop) return;
    setEditorSaving(true);
    setEditorError(null);
    setNotice(null);

    try {
      let parsedQuiz: any = null;
      const quizText = editorQuizJson.trim();
      if (quizText.length > 0) {
        parsedQuiz = JSON.parse(quizText);
      }

      const detailsBody = {
        title: editorTitle.trim(),
        handle: editorHandle.trim() || undefined,
        description: editorDescription.trim() || null,
        hero_image_url: editorHeroImageUrl.trim() || null,
        starts_at: editorStartsAt || null,
        ends_at: editorEndsAt || null,
        quiz_json: parsedQuiz,
      };

      const detailsResult = await adminFetch(`${ADMIN_DROPS_BASE}/${encodeURIComponent(editorDrop.id)}`, {
        method: 'PATCH',
        body: JSON.stringify(detailsBody) as any,
      });
      if (!detailsResult.ok) {
        throw Object.assign(new Error(detailsResult.errText ?? `HTTP_${detailsResult.status}`), {
          status: detailsResult.status,
        });
      }

      const selected = new Set(editorSelectedProductIds);
      const mappingResult = await adminFetch(
        `${ADMIN_DROPS_BASE}/${encodeURIComponent(editorDrop.id)}/products`,
        {
          method: 'PUT',
          body: JSON.stringify({ product_ids: Array.from(selected) }) as any,
        }
      );
      if (!mappingResult.ok) {
        throw Object.assign(new Error(mappingResult.errText ?? `HTTP_${mappingResult.status}`), {
          status: mappingResult.status,
        });
      }

      const mappedCount = selected.size;
      setMappedCountByDropId((prev) => ({
        ...prev,
        [editorDrop.id]: mappedCount,
      }));

      setRows((prev) =>
        prev.map((row) =>
          row.id === editorDrop.id
            ? {
              ...row,
              title: editorTitle.trim() || row.title,
              handle: editorHandle.trim() || row.handle,
              description: editorDescription.trim() || null,
              heroImageUrl: editorHeroImageUrl.trim() || null,
              startsAt: editorStartsAt || null,
              endsAt: editorEndsAt || null,
              quizJson: parsedQuiz,
            }
            : row
        )
      );

      setNotice({ type: 'success', text: 'Drop updated.' });

      closeEditor();
      await load();
    } catch (err: any) {
      const statusPart = err?.status ? `HTTP_${err.status}: ` : '';
      const messagePart = err?.message ?? 'Failed to save drop editor changes.';
      setEditorError(`${statusPart}${messagePart}`);
    } finally {
      setEditorSaving(false);
    }
  };

  const editorProducts = useMemo(() => {
    if (!editorDrop?.artistId) return products;
    return products.filter((product) => product.artistId === editorDrop.artistId);
  }, [products, editorDrop]);

  const toggleEditorProduct = (productId: string) => {
    setEditorSelectedProductIds((prev) =>
      prev.includes(productId) ? prev.filter((id) => id !== productId) : [...prev, productId]
    );
  };

  return (
    <AppShell title="Admin Drops" subtitle="Create and inspect drop campaigns.">
      {error && <ErrorBanner message={error} onRetry={load} />}
      {notice && (
        <p
          role="status"
          className={`rounded-xl border px-4 py-2 text-sm ${notice.type === 'success'
            ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-100'
            : 'border-rose-400/40 bg-rose-500/10 text-rose-700 dark:text-rose-100'
            }`}
        >
          {notice.text}
        </p>
      )}

      <form
        onSubmit={createDrop}
        className="grid gap-3 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 p-4 md:grid-cols-[1.2fr_1fr_auto] shadow-sm"
      >
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Drop title"
          className="rounded-xl border border-slate-200 dark:border-white/15 bg-white dark:bg-black/30 px-3 py-2 text-sm text-slate-900 dark:text-white outline-none focus:border-indigo-400 dark:focus:border-white/40 transition"
        />
        <select
          aria-label="Artist"
          value={selectedArtistId}
          onChange={(event) => setSelectedArtistId(event.target.value)}
          className="rounded-xl border border-slate-200 dark:border-white/15 bg-white dark:bg-black/30 px-3 py-2 text-sm text-slate-900 dark:text-white outline-none focus:border-indigo-400 dark:focus:border-white/40 transition appearance-none"
        >
          <option value="" disabled className="bg-white dark:bg-slate-950">
            Select artist
          </option>
          {artists.map((artist) => (
            <option key={artist.id} value={artist.id} className="bg-white dark:bg-slate-950">
              {artist.name}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={!canCreate}
          className="rounded-xl bg-slate-900 dark:bg-white px-6 py-2 text-sm font-black uppercase tracking-widest text-white dark:text-slate-950 transition-all hover:scale-[1.02] active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {creating ? 'Creating...' : 'Create Drop'}
        </button>
      </form>

      {loading ? (
        <LoadingSkeleton count={2} />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 shadow-sm">
          <div className="grid grid-cols-[1.2fr_1.2fr_0.9fr_1.2fr_1.2fr_1.1fr] gap-3 border-b border-slate-100 dark:border-white/10 px-4 py-3 text-xs font-black uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">
            <span>Title</span>
            <span>Artist</span>
            <span>Status</span>
            <span>Created</span>
            <span>Updated</span>
            <span className="text-right">Actions</span>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-white/10">
            {rows.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">No drops found.</p>
            ) : (
              rows.map((row) => (
                <div
                  key={row.id}
                  className="grid grid-cols-[1.2fr_1.2fr_0.9fr_1.2fr_1.2fr_1.1fr] gap-3 px-4 py-3 text-sm text-slate-700 dark:text-white hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                >
                  <span className="font-medium">{row.title}</span>
                  <span className="text-slate-500 dark:text-slate-400">{row.artistName ?? row.artistId ?? '-'}</span>
                  <span className="flex items-center">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest ${row.status === 'published'
                        ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400'
                        : row.status === 'draft'
                          ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400'
                          : 'bg-slate-100 dark:bg-slate-500/20 text-slate-700 dark:text-slate-400'
                      }`}>
                      {row.status}
                    </span>
                  </span>
                  <span className="text-slate-400 dark:text-slate-500">{formatDateTime(row.createdAt)}</span>
                  <span className="text-slate-400 dark:text-slate-500">{formatDateTime(row.updatedAt)}</span>
                  <div className="relative ml-auto flex items-center justify-end gap-2">
                    <button
                      type="button"
                      data-testid={`admin-drop-edit-${row.id}`}
                      onClick={() => openEditor(row)}
                      className="rounded-lg border border-slate-200 dark:border-white/20 bg-white dark:bg-white/10 px-3 py-1 text-xs font-black uppercase tracking-widest text-slate-900 dark:text-white hover:bg-slate-50 dark:hover:bg-white/20 transition-all active:scale-95"
                    >
                      Edit
                    </button>
                    <div className="relative" data-drop-menu-root={row.id}>
                      <button
                        type="button"
                        data-testid={`admin-drop-menu-${row.id}`}
                        aria-haspopup="menu"
                        aria-expanded={openMenuId === row.id}
                        onClick={() =>
                          setOpenMenuId((prev) => (prev === row.id ? null : row.id))
                        }
                        className="rounded-lg border border-slate-200 dark:border-white/20 px-2.5 py-1 text-sm text-slate-600 dark:text-white/90 hover:bg-slate-50 dark:hover:bg-white/10 transition-all"
                      >
                        ÃƒÂ¢Ã¢â‚¬Â¹Ã‚Â¯
                      </button>
                      {openMenuId === row.id && (
                        <div
                          role="menu"
                          className="absolute right-0 top-10 z-10 w-48 space-y-1 rounded-xl border border-slate-200 dark:border-white/15 bg-white dark:bg-slate-900 p-2 shadow-xl animate-in fade-in zoom-in duration-200"
                        >
                          {row.status === 'draft' && (
                            <>
                              <button
                                type="button"
                                role="menuitem"
                                data-testid={`admin-drop-publish-${row.id}`}
                                onClick={() => runLifecycleAction(row, 'publish')}
                                disabled={
                                  actionLoadingId === row.id || mappedCountByDropId[row.id] === 0
                                }
                                className="flex w-full items-center rounded-lg px-3 py-2 text-left text-xs font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-50 transition"
                              >
                                Publish
                              </button>
                              {mappedCountByDropId[row.id] === 0 && (
                                <p className="px-3 pb-1 text-[9px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-tighter">
                                  Attach products to publish
                                </p>
                              )}
                            </>
                          )}
                          {row.status === 'published' && (
                            <button
                              type="button"
                              role="menuitem"
                              data-testid={`admin-drop-unpublish-${row.id}`}
                              onClick={() => runLifecycleAction(row, 'unpublish')}
                              disabled={actionLoadingId === row.id}
                              className="flex w-full items-center rounded-lg px-3 py-2 text-left text-xs font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50 transition"
                            >
                              Unpublish
                            </button>
                          )}
                          <button
                            type="button"
                            role="menuitem"
                            data-testid={`admin-drop-archive-${row.id}`}
                            onClick={() => runLifecycleAction(row, 'archive')}
                            disabled={actionLoadingId === row.id || row.status === 'archived'}
                            className="flex w-full items-center rounded-lg px-3 py-2 text-left text-xs font-black uppercase tracking-widest text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-50 transition"
                          >
                            Archive
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {editorDrop && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-md p-4 transition-all duration-300 animate-in fade-in"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeEditor();
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-drop-title"
            className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 shadow-2xl text-slate-900 dark:text-white animate-in zoom-in-95 duration-200"
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 dark:border-white/5 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl px-6 py-5">
              <div>
                <h2 id="edit-drop-title" className="text-2xl font-black text-slate-900 dark:text-white">
                  Edit Drop
                </h2>
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Campaign Management</p>
              </div>
              <button
                type="button"
                onClick={closeEditor}
                className="rounded-full border border-slate-200 dark:border-white/10 bg-white dark:bg-transparent px-5 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-white hover:bg-slate-50 dark:hover:bg-white/5 transition-all active:scale-95"
              >
                Close
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-6 scrollbar-hide">
              {editorError && (
                <p
                  role="alert"
                  className="rounded-xl border border-rose-200 dark:border-rose-400/40 bg-rose-50 dark:bg-rose-500/10 px-4 py-3 text-sm font-medium text-rose-600 dark:text-rose-100"
                >
                  {editorError}
                </p>
              )}

              <div className="grid gap-6 md:grid-cols-2">
                <section className="space-y-4 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/5 p-5">
                  <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400 dark:text-slate-500">Core Details</p>
                  <div className="space-y-4">
                    <label className="block space-y-1.5">
                      <span className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Title</span>
                      <input
                        ref={editorTitleInputRef}
                        value={editorTitle}
                        onChange={(event) => setEditorTitle(event.target.value)}
                        className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-black/30 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-indigo-500 dark:focus:border-white/40 transition outline-none"
                      />
                    </label>
                    <label className="block space-y-1.5">
                      <span className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Slug / Handle</span>
                      <input
                        value={editorHandle}
                        onChange={(event) => setEditorHandle(event.target.value)}
                        className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-black/30 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-indigo-500 dark:focus:border-white/40 transition outline-none"
                      />
                      <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 block pt-1">
                        Leave blank to auto-generate from title.
                      </span>
                    </label>
                    <div className="grid grid-cols-2 gap-4">
                      <label className="block space-y-1.5">
                        <span className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Starts At</span>
                        <input
                          type="datetime-local"
                          value={editorStartsAt}
                          onChange={(event) => setEditorStartsAt(event.target.value)}
                          className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-black/30 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-indigo-500 dark:focus:border-white/40 transition outline-none"
                        />
                      </label>
                      <label className="block space-y-1.5">
                        <span className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Ends At</span>
                        <input
                          type="datetime-local"
                          value={editorEndsAt}
                          onChange={(event) => setEditorEndsAt(event.target.value)}
                          className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-black/30 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-indigo-500 dark:focus:border-white/40 transition outline-none"
                        />
                      </label>
                    </div>
                  </div>
                </section>

                <section className="space-y-4 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/5 p-5">
                  <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400 dark:text-slate-500">Visuals</p>
                  <div className="space-y-4">
                    <label className="block space-y-1.5">
                      <span className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Hero Image URL</span>
                      <input
                        value={editorHeroImageUrl}
                        onChange={(event) => setEditorHeroImageUrl(event.target.value)}
                        className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-black/30 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-indigo-500 dark:focus:border-white/40 transition outline-none"
                      />
                    </label>
                    <div className="flex items-center gap-4 p-4 border border-dashed border-slate-200 dark:border-white/10 rounded-2xl">
                      <div className="h-16 w-16 rounded-xl bg-slate-100 dark:bg-black/40 overflow-hidden flex-shrink-0 flex items-center justify-center border border-slate-100 dark:border-white/5">
                        {editorHeroImageUrl ? (
                          <img src={editorHeroImageUrl} alt="Preview" className="h-full w-full object-cover" />
                        ) : (
                          <span className="text-[10px] text-slate-400">No Image</span>
                        )}
                      </div>
                      <div className="space-y-1">
                        <button
                          type="button"
                          onClick={() => heroUploadInputRef.current?.click()}
                          disabled={heroUploadBusy || editorSaving}
                          className="rounded-lg bg-slate-900 dark:bg-white px-4 py-1.5 text-[10px] font-black uppercase tracking-widest text-white dark:text-slate-950 hover:opacity-90 transition-all active:scale-95 disabled:opacity-50"
                        >
                          {heroUploadBusy ? 'Uploading...' : 'Upload Image'}
                        </button>
                        <p className="text-[10px] text-slate-400">JPG, PNG or WEBP up to 5MB</p>
                      </div>
                    </div>
                    {heroUploadStatus && (
                      <p className={`text-[10px] font-black uppercase tracking-widest ${heroUploadStatus.type === 'success' ? 'text-emerald-600 dark:text-emerald-400 animate-pulse' :
                          heroUploadStatus.type === 'error' ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500'
                        }`}>
                        {heroUploadStatus.text}
                      </p>
                    )}
                  </div>
                </section>
              </div>

              <section className="space-y-4 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/5 p-5">
                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400 dark:text-slate-500">Description & Content</p>
                <textarea
                  value={editorDescription}
                  onChange={(event) => setEditorDescription(event.target.value)}
                  rows={4}
                  placeholder="Tell the story of this drop..."
                  className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-black/30 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-indigo-500 dark:focus:border-white/40 transition outline-none"
                />
              </section>

              <div className="grid gap-6 md:grid-cols-2">
                <section className="space-y-4 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/5 p-5">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400 dark:text-slate-500">Products Attachment</p>
                    <span className="text-[10px] font-black bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full">{editorSelectedProductIds.length} Selected</span>
                  </div>
                  {editorLoading ? (
                    <p className="text-xs font-bold uppercase tracking-widest text-slate-400 animate-pulse">Loading Products...</p>
                  ) : editorProducts.length === 0 ? (
                    <p className="text-xs text-slate-500">No products found for this artist.</p>
                  ) : (
                    <div className="max-h-60 space-y-1 overflow-auto pr-2 custom-scrollbar">
                      {editorProducts.map((product) => (
                        <label key={product.id} className="flex items-center gap-3 p-2 rounded-xl border border-transparent hover:bg-white dark:hover:bg-white/5 hover:border-slate-100 dark:hover:border-white/5 group cursor-pointer transition-all">
                          <input
                            type="checkbox"
                            checked={editorSelectedProductIds.includes(product.id)}
                            onChange={() => toggleEditorProduct(product.id)}
                            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          <span className="text-sm font-medium text-slate-700 dark:text-slate-300 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{product.title}</span>
                          <span className="text-[10px] text-slate-400 ml-auto opacity-0 group-hover:opacity-100 transition-opacity">#{product.id.slice(0, 8)}</span>
                        </label>
                      ))}
                    </div>
                  )}
                  {!editorLoading && editorSelectedProductIds.length === 0 && (
                    <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-500/20 text-amber-700 dark:text-amber-400">
                      <span className="text-[10px] font-black uppercase tracking-widest">Warning:</span>
                      <span className="text-[10px] font-bold">Attach at least one product to publish.</span>
                    </div>
                  )}
                </section>

                <section className="space-y-4 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/5 p-5">
                  <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400 dark:text-slate-500">Quiz Configuration (JSON)</p>
                  <textarea
                    value={editorQuizJson}
                    onChange={(event) => setEditorQuizJson(event.target.value)}
                    rows={10}
                    placeholder='{ "questions": [] }'
                    className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-black/30 px-3 py-2 font-mono text-xs text-slate-900 dark:text-white focus:border-indigo-500 dark:focus:border-white/40 transition outline-none"
                  />
                  <p className="text-[9px] font-bold uppercase tracking-tighter text-slate-400">
                    Advanced configuration for the drop quiz interaction mechanism.
                  </p>
                </section>
              </div>
            </div>

            <div className="sticky bottom-0 flex items-center justify-between border-t border-slate-100 dark:border-white/5 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl px-6 py-5">
              <button
                type="button"
                onClick={closeEditor}
                className="rounded-full border border-slate-200 dark:border-white/10 bg-white dark:bg-transparent px-8 py-2.5 text-xs font-black uppercase tracking-widest text-slate-500 dark:text-white hover:bg-slate-50 dark:hover:bg-white/5 transition-all active:scale-95"
              >
                Discard Changes
              </button>
              <button
                type="button"
                onClick={saveEditor}
                disabled={editorSaving || editorLoading}
                className="rounded-full bg-slate-900 dark:bg-white px-10 py-2.5 text-xs font-black uppercase tracking-widest text-white dark:text-slate-950 transition-all hover:scale-[1.02] active:scale-95 shadow-xl shadow-slate-900/10 dark:shadow-none disabled:opacity-50"
              >
                {editorSaving ? 'Saving...' : 'Save Drop'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
