import React, { useEffect, useMemo, useRef, useState } from 'react';
import AppShell from '../../components/layout/AppShell';
import ErrorBanner from '../../components/ux/ErrorBanner';
import LoadingSkeleton from '../../components/ux/LoadingSkeleton';
import { apiFetch } from '../../shared/api/http';

const ADMIN_DROPS_BASE = '/api/admin/drops';

type AdminFetchResult<T> = {
  ok: boolean;
  status: number;
  data?: T;
  errText?: string;
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
    return {
      ok: false,
      status: Number(err?.status ?? 0),
      errText: String(err?.message ?? 'Request failed'),
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
  const editorTitleInputRef = useRef<HTMLInputElement | null>(null);

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
        .filter((item): item is DropRow => Boolean(item));
      const normalizedArtists = artistItems
        .map((artist) => {
          const id = artist?.id;
          if (!id) return null;
          return {
            id: String(id),
            name: String(artist?.name ?? artist?.handle ?? id),
          };
        })
        .filter((item): item is ArtistOption => Boolean(item));
      const normalizedProducts = productItems
        .map((product) => {
          const id = product?.id;
          if (!id) return null;
          return {
            id: String(id),
            title: String(product?.title ?? id),
            artistId: product?.artistId ?? product?.artist_id ?? undefined,
          };
        })
        .filter((item): item is ProductOption => Boolean(item));

      const artistNameById = new Map(normalizedArtists.map((artist) => [artist.id, artist.name]));
      const rowsWithArtistNames = normalizedDrops.map((drop) => ({
        ...drop,
        artistName: drop.artistName ?? (drop.artistId ? artistNameById.get(drop.artistId) : null) ?? undefined,
      }));

      setRows(rowsWithArtistNames);
      setArtists(normalizedArtists);
      setProducts(normalizedProducts);
      setSelectedArtistId((prev) => prev || normalizedArtists[0]?.id || '');
      setMappedCountByDropId((prev) => {
        const next = { ...prev };
        rowsWithArtistNames.forEach((row) => {
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
        body: createBody as any,
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
        body: detailsBody as any,
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
          body: { product_ids: Array.from(selected) } as any,
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
          className={`rounded-xl border px-4 py-2 text-sm ${
            notice.type === 'success'
              ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-100'
              : 'border-rose-400/40 bg-rose-500/10 text-rose-100'
          }`}
        >
          {notice.text}
        </p>
      )}

      <form
        onSubmit={createDrop}
        className="grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 md:grid-cols-[1.2fr_1fr_auto]"
      >
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Drop title"
          className="rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
        />
        <select
          aria-label="Artist"
          value={selectedArtistId}
          onChange={(event) => setSelectedArtistId(event.target.value)}
          className="rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-white/40"
        >
          <option value="" disabled>
            Select artist
          </option>
          {artists.map((artist) => (
            <option key={artist.id} value={artist.id}>
              {artist.name}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={!canCreate}
          className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {creating ? 'Creating...' : 'Create Drop'}
        </button>
      </form>

      {loading ? (
        <LoadingSkeleton count={2} />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
          <div className="grid grid-cols-[1.2fr_1.2fr_0.9fr_1.2fr_1.2fr_1.1fr] gap-3 border-b border-white/10 px-4 py-3 text-xs uppercase tracking-[0.3em] text-slate-400">
            <span>Title</span>
            <span>Artist</span>
            <span>Status</span>
            <span>Created</span>
            <span>Updated</span>
            <span>Actions</span>
          </div>
          <div className="divide-y divide-white/10">
            {rows.length === 0 ? (
              <p className="px-4 py-4 text-sm text-slate-400">No drops found.</p>
            ) : (
              rows.map((row) => (
                <div
                  key={row.id}
                  className="grid grid-cols-[1.2fr_1.2fr_0.9fr_1.2fr_1.2fr_1.1fr] gap-3 px-4 py-3 text-sm text-white"
                >
                  <span>{row.title}</span>
                  <span>{row.artistName ?? row.artistId ?? '-'}</span>
                  <span>{row.status}</span>
                  <span>{formatDateTime(row.createdAt)}</span>
                  <span>{formatDateTime(row.updatedAt)}</span>
                  <div className="relative ml-auto flex items-start justify-end gap-2">
                    <button
                      type="button"
                      data-testid={`admin-drop-edit-${row.id}`}
                      onClick={() => openEditor(row)}
                      className="rounded-lg border border-white/20 bg-white/10 px-2.5 py-1 text-xs font-semibold text-white hover:bg-white/20"
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
                        className="rounded-lg border border-white/20 px-2 py-1 text-sm text-white/90 hover:bg-white/10"
                      >
                        ⋯
                      </button>
                      {openMenuId === row.id && (
                        <div
                          role="menu"
                          className="absolute right-0 top-8 z-10 w-44 space-y-1 rounded-lg border border-white/15 bg-slate-950 p-2 shadow-lg"
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
                                className="w-full rounded-md px-2 py-1 text-left text-xs text-white hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                Publish
                              </button>
                              {mappedCountByDropId[row.id] === 0 && (
                                <p className="px-2 text-[11px] text-amber-300">
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
                              className="w-full rounded-md px-2 py-1 text-left text-xs text-white hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
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
                            className="w-full rounded-md px-2 py-1 text-left text-xs text-rose-100 hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-50"
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
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
            className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-950/95 shadow-xl"
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-slate-950/95 px-5 py-4">
              <h2 id="edit-drop-title" className="text-lg font-semibold text-white">
                Edit Drop
              </h2>
              <button
                type="button"
                onClick={closeEditor}
                className="rounded-lg border border-white/20 px-3 py-1 text-xs text-white hover:bg-white/10"
              >
                Close
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
              {editorError && (
                <p
                  role="alert"
                  className="rounded-lg border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-100"
                >
                  {editorError}
                </p>
              )}

              <section className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Details</p>
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="space-y-1">
                    <span className="text-xs text-slate-300">Title (required)</span>
                    <input
                      ref={editorTitleInputRef}
                      value={editorTitle}
                      onChange={(event) => setEditorTitle(event.target.value)}
                      className="w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-white"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs text-slate-300">Slug / Handle (optional)</span>
                    <input
                      value={editorHandle}
                      onChange={(event) => setEditorHandle(event.target.value)}
                      className="w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-white"
                    />
                    <span className="text-[11px] text-slate-400">
                      Used in URLs. Leave blank to auto-generate.
                    </span>
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs text-slate-300">Hero image URL</span>
                    <input
                      value={editorHeroImageUrl}
                      onChange={(event) => setEditorHeroImageUrl(event.target.value)}
                      className="w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-white"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-xs text-slate-300">Starts at</span>
                    <input
                      type="datetime-local"
                      value={editorStartsAt}
                      onChange={(event) => setEditorStartsAt(event.target.value)}
                      className="w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-white"
                    />
                  </label>
                  <label className="space-y-1 md:col-start-2">
                    <span className="text-xs text-slate-300">Ends at</span>
                    <input
                      type="datetime-local"
                      value={editorEndsAt}
                      onChange={(event) => setEditorEndsAt(event.target.value)}
                      className="w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-white"
                    />
                  </label>
                  <label className="space-y-1 md:col-span-2">
                    <span className="text-xs text-slate-300">Description</span>
                    <textarea
                      value={editorDescription}
                      onChange={(event) => setEditorDescription(event.target.value)}
                      rows={3}
                      className="w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-white"
                    />
                  </label>
                </div>
              </section>

              <section className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Products</p>
                <p className="text-sm text-slate-200">Attach products (required to publish)</p>
                {editorLoading ? (
                  <p className="text-sm text-slate-400">Loading mapped products...</p>
                ) : editorProducts.length === 0 ? (
                  <p className="text-sm text-slate-400">No products found for this artist.</p>
                ) : (
                  <div className="max-h-52 space-y-2 overflow-auto pr-1">
                    {editorProducts.map((product) => (
                      <label key={product.id} className="flex items-center gap-2 text-sm text-white">
                        <input
                          type="checkbox"
                          checked={editorSelectedProductIds.includes(product.id)}
                          onChange={() => toggleEditorProduct(product.id)}
                        />
                        <span>{product.title}</span>
                      </label>
                    ))}
                  </div>
                )}
                {!editorLoading && editorSelectedProductIds.length === 0 && (
                  <p className="text-sm text-amber-300">Attach at least one product to publish this drop.</p>
                )}
              </section>

              <section className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Quiz</p>
                <p className="text-[11px] text-slate-400">
                  JSON format. Example: {'{ "questions": [] }'}
                </p>
                <textarea
                  value={editorQuizJson}
                  onChange={(event) => setEditorQuizJson(event.target.value)}
                  rows={6}
                  className="w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 font-mono text-sm text-white"
                />
              </section>
            </div>

            <div className="sticky bottom-0 flex justify-end gap-2 border-t border-white/10 bg-slate-950/95 px-5 py-4">
              <button
                type="button"
                onClick={closeEditor}
                className="rounded-xl border border-white/20 px-4 py-2 text-sm text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveEditor}
                disabled={editorSaving || editorLoading}
                className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/20 disabled:opacity-60"
              >
                {editorSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
