import { useCallback, useEffect, useMemo, useState } from 'react';
import type { DropLifecycleAction, DropNotice, DropRow } from '../components/drops/types';
import {
  createAdminDrop,
  fetchAdminDropsSnapshot,
  runAdminDropLifecycle,
} from './adminDropsApi';

const getDropPathKey = (row: DropRow) => row.handle || row.id;

export function useAdminDropsPage() {
  const [rows, setRows] = useState<DropRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [artists, setArtists] = useState<{ id: string; name: string }[]>([]);
  const [products, setProducts] = useState<{ id: string; title: string; artistId?: string }[]>([]);
  const [mappedCountByDropId, setMappedCountByDropId] = useState<Record<string, number>>({});
  const [title, setTitle] = useState('');
  const [selectedArtistId, setSelectedArtistId] = useState('');
  const [creating, setCreating] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [notice, setNotice] = useState<DropNotice | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const snapshot = await fetchAdminDropsSnapshot();
      setRows(snapshot.rows);
      setArtists(snapshot.artists);
      setProducts(snapshot.products);
      setSelectedArtistId((prev) => prev || snapshot.artists[0]?.id || '');
      setMappedCountByDropId((prev) => ({
        ...prev,
        ...snapshot.mappedCountByDropId,
      }));
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load drops');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

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

  const canCreate = useMemo(
    () => !creating && title.trim().length > 0 && selectedArtistId.trim().length > 0,
    [creating, title, selectedArtistId]
  );

  const createDrop = useCallback(
    async (event: React.FormEvent) => {
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
        const created = await createAdminDrop(title.trim(), chosenArtistId);
        if (created) {
          const artistName = artists.find((artist) => artist.id === chosenArtistId)?.name ?? chosenArtistId;
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
    },
    [artists, canCreate, selectedArtistId, title]
  );

  const runLifecycleAction = useCallback(
    async (row: DropRow, action: DropLifecycleAction) => {
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

        await runAdminDropLifecycle(getDropPathKey(row), action);
        setNotice({ type: 'success', text: `Drop ${action}ed.` });
        await load();
      } catch (err: any) {
        setNotice({ type: 'error', text: err?.message ?? `Failed to ${action} drop` });
      } finally {
        setActionLoadingId(null);
      }
    },
    [load, mappedCountByDropId]
  );

  return {
    rows,
    setRows,
    loading,
    error,
    artists,
    products,
    mappedCountByDropId,
    setMappedCountByDropId,
    title,
    setTitle,
    selectedArtistId,
    setSelectedArtistId,
    creating,
    actionLoadingId,
    openMenuId,
    setOpenMenuId,
    notice,
    setNotice,
    canCreate,
    load,
    createDrop,
    runLifecycleAction,
  };
}
