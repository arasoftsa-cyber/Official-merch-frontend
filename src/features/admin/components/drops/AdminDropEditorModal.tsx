import React from 'react';
import AdminSectionSurface from '../shared/AdminSectionSurface';
import type { HeroUploadStatus, ProductOption } from './types';

type AdminDropEditorModalProps = {
  isOpen: boolean;
  editorError: string | null;
  editorTitle: string;
  editorHandle: string;
  editorDescription: string;
  editorHeroImageUrl: string;
  editorStartsAt: string;
  editorEndsAt: string;
  editorQuizJson: string;
  editorProducts: ProductOption[];
  editorSelectedProductIds: string[];
  editorLoading: boolean;
  editorSaving: boolean;
  heroUploadBusy: boolean;
  heroUploadStatus: HeroUploadStatus | null;
  editorTitleInputRef: React.RefObject<HTMLInputElement>;
  heroUploadInputRef: React.RefObject<HTMLInputElement>;
  onClose: () => void;
  onSave: () => void;
  onTitleChange: (value: string) => void;
  onHandleChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onHeroImageUrlChange: (value: string) => void;
  onStartsAtChange: (value: string) => void;
  onEndsAtChange: (value: string) => void;
  onQuizJsonChange: (value: string) => void;
  onToggleProduct: (productId: string) => void;
  onUploadHeroImage: (file: File | null) => void;
};

export default function AdminDropEditorModal({
  isOpen,
  editorError,
  editorTitle,
  editorHandle,
  editorDescription,
  editorHeroImageUrl,
  editorStartsAt,
  editorEndsAt,
  editorQuizJson,
  editorProducts,
  editorSelectedProductIds,
  editorLoading,
  editorSaving,
  heroUploadBusy,
  heroUploadStatus,
  editorTitleInputRef,
  heroUploadInputRef,
  onClose,
  onSave,
  onTitleChange,
  onHandleChange,
  onDescriptionChange,
  onHeroImageUrlChange,
  onStartsAtChange,
  onEndsAtChange,
  onQuizJsonChange,
  onToggleProduct,
  onUploadHeroImage,
}: AdminDropEditorModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-md p-4 transition-all duration-300 animate-in fade-in"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
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
            onClick={onClose}
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
            <AdminSectionSurface className="space-y-4">
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400 dark:text-slate-500">Core Details</p>
              <div className="space-y-4">
                <label className="block space-y-1.5">
                  <span className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Title</span>
                  <input
                    ref={editorTitleInputRef}
                    value={editorTitle}
                    onChange={(event) => onTitleChange(event.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-black/30 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-indigo-500 dark:focus:border-white/40 transition outline-none"
                  />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Slug / Handle</span>
                  <input
                    value={editorHandle}
                    onChange={(event) => onHandleChange(event.target.value)}
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
                      onChange={(event) => onStartsAtChange(event.target.value)}
                      className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-black/30 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-indigo-500 dark:focus:border-white/40 transition outline-none"
                    />
                  </label>
                  <label className="block space-y-1.5">
                    <span className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Ends At</span>
                    <input
                      type="datetime-local"
                      value={editorEndsAt}
                      onChange={(event) => onEndsAtChange(event.target.value)}
                      className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-black/30 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-indigo-500 dark:focus:border-white/40 transition outline-none"
                    />
                  </label>
                </div>
              </div>
            </AdminSectionSurface>

            <AdminSectionSurface className="space-y-4">
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400 dark:text-slate-500">Visuals</p>
              <div className="space-y-4">
                <label className="block space-y-1.5">
                  <span className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Hero Image URL</span>
                  <input
                    value={editorHeroImageUrl}
                    onChange={(event) => onHeroImageUrlChange(event.target.value)}
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
                  <p className={`text-[10px] font-black uppercase tracking-widest ${heroUploadStatus.type === 'success'
                    ? 'text-emerald-600 dark:text-emerald-400 animate-pulse'
                    : heroUploadStatus.type === 'error'
                      ? 'text-rose-600 dark:text-rose-400'
                      : 'text-slate-500'
                    }`}>
                    {heroUploadStatus.text}
                  </p>
                )}
              </div>
            </AdminSectionSurface>
          </div>

          <AdminSectionSurface className="space-y-4">
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400 dark:text-slate-500">Description & Content</p>
            <textarea
              value={editorDescription}
              onChange={(event) => onDescriptionChange(event.target.value)}
              rows={4}
              placeholder="Tell the story of this drop..."
              className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-black/30 px-3 py-2 text-sm text-slate-900 dark:text-white focus:border-indigo-500 dark:focus:border-white/40 transition outline-none"
            />
          </AdminSectionSurface>

          <div className="grid gap-6 md:grid-cols-2">
            <AdminSectionSurface className="space-y-4">
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
                        onChange={() => onToggleProduct(product.id)}
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
            </AdminSectionSurface>

            <AdminSectionSurface className="space-y-4">
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400 dark:text-slate-500">Quiz Configuration (JSON)</p>
              <textarea
                value={editorQuizJson}
                onChange={(event) => onQuizJsonChange(event.target.value)}
                rows={10}
                placeholder='{ "questions": [] }'
                className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-black/30 px-3 py-2 font-mono text-xs text-slate-900 dark:text-white focus:border-indigo-500 dark:focus:border-white/40 transition outline-none"
              />
              <p className="text-[9px] font-bold uppercase tracking-tighter text-slate-400">
                Advanced configuration for the drop quiz interaction mechanism.
              </p>
            </AdminSectionSurface>
          </div>
        </div>

        <div className="sticky bottom-0 flex items-center justify-between border-t border-slate-100 dark:border-white/5 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl px-6 py-5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-200 dark:border-white/10 bg-white dark:bg-transparent px-8 py-2.5 text-xs font-black uppercase tracking-widest text-slate-500 dark:text-white hover:bg-slate-50 dark:hover:bg-white/5 transition-all active:scale-95"
          >
            Discard Changes
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={editorSaving || editorLoading}
            className="rounded-full bg-slate-900 dark:bg-white px-10 py-2.5 text-xs font-black uppercase tracking-widest text-white dark:text-slate-950 transition-all hover:scale-[1.02] active:scale-95 shadow-xl shadow-slate-900/10 dark:shadow-none disabled:opacity-50"
          >
            {editorSaving ? 'Saving...' : 'Save Drop'}
          </button>
        </div>

        <input
          ref={heroUploadInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(event) => onUploadHeroImage(event.target.files?.[0] ?? null)}
        />
      </div>
    </div>
  );
}
