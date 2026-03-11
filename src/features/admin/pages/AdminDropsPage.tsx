import React from 'react';
import AppShell from '../../../shared/components/layout/AppShell';
import ErrorBanner from '../../../shared/components/ux/ErrorBanner';
import LoadingSkeleton from '../../../shared/components/ux/LoadingSkeleton';
import AdminDropEditorModal from '../components/drops/AdminDropEditorModal';
import AdminDropsCreateForm from '../components/drops/AdminDropsCreateForm';
import AdminDropsList from '../components/drops/AdminDropsList';
import { useAdminDropEditor } from '../drops/useAdminDropEditor';
import { useAdminDropsPage } from '../drops/useAdminDropsPage';

const formatDateTime = (value?: string | null) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
};

export default function AdminDropsPage() {
  const {
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
  } = useAdminDropsPage();

  const {
    editorDrop,
    editorError,
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
    editorProducts,
    editorSelectedProductIds,
    editorLoading,
    editorSaving,
    heroUploadBusy,
    heroUploadStatus,
    editorTitleInputRef,
    heroUploadInputRef,
    closeEditor,
    saveEditor,
    openEditor,
    toggleEditorProduct,
    uploadHeroImage,
  } = useAdminDropEditor({
    products,
    setRows,
    setMappedCountByDropId,
    setNotice,
    reload: load,
  });

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

      <AdminDropsCreateForm
        title={title}
        selectedArtistId={selectedArtistId}
        creating={creating}
        canCreate={canCreate}
        artists={artists}
        onSubmit={createDrop}
        onTitleChange={setTitle}
        onArtistChange={setSelectedArtistId}
      />

      {loading && <LoadingSkeleton count={2} />}

      <AdminDropsList
        loading={loading}
        rows={rows}
        openMenuId={openMenuId}
        actionLoadingId={actionLoadingId}
        mappedCountByDropId={mappedCountByDropId}
        formatDateTime={formatDateTime}
        onEditDrop={openEditor}
        onToggleRowMenu={(rowId) => setOpenMenuId((prev) => (prev === rowId ? null : rowId))}
        onRunLifecycleAction={runLifecycleAction}
      />

      <AdminDropEditorModal
        isOpen={Boolean(editorDrop)}
        editorError={editorError}
        editorTitle={editorTitle}
        editorHandle={editorHandle}
        editorDescription={editorDescription}
        editorHeroImageUrl={editorHeroImageUrl}
        editorStartsAt={editorStartsAt}
        editorEndsAt={editorEndsAt}
        editorQuizJson={editorQuizJson}
        editorProducts={editorProducts}
        editorSelectedProductIds={editorSelectedProductIds}
        editorLoading={editorLoading}
        editorSaving={editorSaving}
        heroUploadBusy={heroUploadBusy}
        heroUploadStatus={heroUploadStatus}
        editorTitleInputRef={editorTitleInputRef}
        heroUploadInputRef={heroUploadInputRef}
        onClose={closeEditor}
        onSave={saveEditor}
        onTitleChange={setEditorTitle}
        onHandleChange={setEditorHandle}
        onDescriptionChange={setEditorDescription}
        onHeroImageUrlChange={setEditorHeroImageUrl}
        onStartsAtChange={setEditorStartsAt}
        onEndsAtChange={setEditorEndsAt}
        onQuizJsonChange={setEditorQuizJson}
        onToggleProduct={toggleEditorProduct}
        onUploadHeroImage={uploadHeroImage}
      />
    </AppShell>
  );
}
