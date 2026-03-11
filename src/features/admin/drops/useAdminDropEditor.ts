import { useEffect, useMemo, useRef, useState } from 'react';
import type { DropNotice, DropRow, HeroUploadStatus, ProductOption } from '../components/drops/types';
import {
  ALLOWED_HERO_IMAGE_MIME_TYPES,
  fetchAdminDropProductIds,
  MAX_HERO_IMAGE_BYTES,
  patchAdminDropDetails,
  replaceAdminDropProducts,
  uploadAdminDropHeroImage,
} from './adminDropsApi';

type UseAdminDropEditorOptions = {
  products: ProductOption[];
  setRows: React.Dispatch<React.SetStateAction<DropRow[]>>;
  setMappedCountByDropId: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  setNotice: (notice: DropNotice | null) => void;
  reload: () => Promise<void>;
};

export function useAdminDropEditor({
  products,
  setRows,
  setMappedCountByDropId,
  setNotice,
  reload,
}: UseAdminDropEditorOptions) {
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
  const [heroUploadStatus, setHeroUploadStatus] = useState<HeroUploadStatus | null>(null);
  const editorTitleInputRef = useRef<HTMLInputElement | null>(null);
  const heroUploadInputRef = useRef<HTMLInputElement | null>(null);

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

  const openEditor = async (row: DropRow) => {
    setEditorDrop(row);
    setEditorTitle(row.title ?? '');
    setEditorHandle(row.handle ?? '');
    setEditorDescription(row.description ?? '');
    setEditorHeroImageUrl(row.heroImageUrl ?? '');
    setEditorStartsAt(row.startsAt ? String(row.startsAt).slice(0, 16) : '');
    setEditorEndsAt(row.endsAt ? String(row.endsAt).slice(0, 16) : '');
    setEditorQuizJson(row.quizJson ? JSON.stringify(row.quizJson, null, 2) : '');
    setEditorSelectedProductIds([]);
    setEditorInitialProductIds([]);
    setEditorError(null);
    setHeroUploadStatus(null);
    setEditorLoading(true);

    try {
      const mappedIds = await fetchAdminDropProductIds(row.id);
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
      const uploadedUrl = await uploadAdminDropHeroImage(dropId, file);
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

      await patchAdminDropDetails(editorDrop.id, {
        title: editorTitle.trim(),
        handle: editorHandle.trim() || undefined,
        description: editorDescription.trim() || null,
        hero_image_url: editorHeroImageUrl.trim() || null,
        starts_at: editorStartsAt || null,
        ends_at: editorEndsAt || null,
        quiz_json: parsedQuiz,
      });

      const selected = new Set(editorSelectedProductIds);
      await replaceAdminDropProducts(editorDrop.id, Array.from(selected));

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
      await reload();
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

  return {
    editorDrop,
    editorTitle,
    setEditorTitle,
    editorHandle,
    setEditorHandle,
    editorDescription,
    setEditorDescription,
    editorHeroImageUrl,
    setEditorHeroImageUrl,
    editorStartsAt,
    setEditorStartsAt,
    editorEndsAt,
    setEditorEndsAt,
    editorQuizJson,
    setEditorQuizJson,
    editorSelectedProductIds,
    editorLoading,
    editorSaving,
    editorError,
    heroUploadBusy,
    heroUploadStatus,
    editorTitleInputRef,
    heroUploadInputRef,
    editorProducts,
    closeEditor,
    openEditor,
    uploadHeroImage,
    saveEditor,
    toggleEditorProduct,
  };
}
