import React from 'react';
import AdminDropStatusBadge from './AdminDropStatusBadge';
import type { DropLifecycleAction, DropRow } from './types';

type AdminDropsListProps = {
  loading: boolean;
  rows: DropRow[];
  openMenuId: string | null;
  actionLoadingId: string | null;
  mappedCountByDropId: Record<string, number>;
  formatDateTime: (value?: string | null) => string;
  onEditDrop: (row: DropRow) => void;
  onToggleRowMenu: (rowId: string) => void;
  onRunLifecycleAction: (row: DropRow, action: DropLifecycleAction) => void;
};

export default function AdminDropsList({
  loading,
  rows,
  openMenuId,
  actionLoadingId,
  mappedCountByDropId,
  formatDateTime,
  onEditDrop,
  onToggleRowMenu,
  onRunLifecycleAction,
}: AdminDropsListProps) {
  if (loading) {
    return null;
  }

  return (
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
                <AdminDropStatusBadge status={row.status} />
              </span>
              <span className="text-slate-400 dark:text-slate-500">{formatDateTime(row.createdAt)}</span>
              <span className="text-slate-400 dark:text-slate-500">{formatDateTime(row.updatedAt)}</span>
              <div className="relative ml-auto flex items-center justify-end gap-2">
                <button
                  type="button"
                  data-testid={`admin-drop-edit-${row.id}`}
                  onClick={() => onEditDrop(row)}
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
                    onClick={() => onToggleRowMenu(row.id)}
                    className="rounded-lg border border-slate-200 dark:border-white/20 px-2.5 py-1 text-sm text-slate-600 dark:text-white/90 hover:bg-slate-50 dark:hover:bg-white/10 transition-all"
                  >
                    ...
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
                            onClick={() => onRunLifecycleAction(row, 'publish')}
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
                          onClick={() => onRunLifecycleAction(row, 'unpublish')}
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
                        onClick={() => onRunLifecycleAction(row, 'archive')}
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
  );
}
