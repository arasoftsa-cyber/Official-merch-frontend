import React from 'react';
import type { ArtistRequest } from '../../artistRequests/types';
import AdminArtistRequestStatusChip from './AdminArtistRequestStatusChip';

type AdminArtistRequestsListProps = {
  requests: ArtistRequest[];
  page: number;
  total: number;
  pageSize: number;
  offset: number;
  onOpenReview: (request: ArtistRequest) => void;
  onPrevPage: () => void;
  onNextPage: () => void;
};

export default function AdminArtistRequestsList({
  requests,
  page,
  total,
  pageSize,
  offset,
  onOpenReview,
  onPrevPage,
  onNextPage,
}: AdminArtistRequestsListProps) {
  if (requests.length === 0) {
    return <p className="text-sm text-slate-500 dark:text-white/60">No pending artist requests</p>;
  }

  return (
    <>
      <div className="space-y-4">
        {requests.map((request) => (
          <div
            key={request.id}
            className="group relative overflow-hidden rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 p-6 shadow-sm hover:shadow-md dark:hover:bg-white/[0.07] transition-all duration-300"
          >
            <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className="rounded-md bg-indigo-50 dark:bg-indigo-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-500/20">
                    {request.source.replace(/_/g, ' ')}
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                    ID: {request.id}
                  </span>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-emerald-400 transition-colors">
                    {request.artistName}
                  </h3>
                  {request.handle && (
                    <p className="font-mono text-sm text-indigo-600 dark:text-emerald-400">@{request.handle}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <p className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                    <svg className="h-4 w-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    {request.email || 'No email provided'}
                  </p>
                  {request.phone && (
                    <p className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                      <svg className="h-4 w-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5.25L3 18.75C3 19.3023 3.44772 19.75 4 19.75H20C20.5523 19.75 21 19.3023 21 18.75V5.25C21 4.69772 20.5523 4.25 20 4.25H4C3.44772 4.25 3 4.69772 3 5.25Z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5.25L12 11.25L21 5.25" />
                      </svg>
                      {request.phone}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 rounded-lg bg-slate-50 dark:bg-black/20 px-3 py-2 border border-slate-100 dark:border-white/5 w-fit">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Requested Plan</span>
                  <span className="text-xs font-bold text-slate-700 dark:text-white uppercase tracking-wider">
                    {request.requestedPlanType || 'BASIC'}
                  </span>
                </div>
              </div>
              <div className="flex flex-col items-end gap-4 min-w-[200px]">
                <div className="flex flex-col items-end">
                  <AdminArtistRequestStatusChip status={request.status} />
                  <span className="mt-2 text-[10px] font-medium text-slate-400 dark:text-slate-500">
                    {new Date(request.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenReview(request)}
                  className="group/btn relative inline-flex items-center justify-center rounded-xl bg-slate-900 dark:bg-white px-8 py-3 text-xs font-bold uppercase tracking-widest text-white dark:text-slate-950 transition-all hover:scale-[1.02] active:scale-95 shadow-lg shadow-slate-900/10 dark:shadow-white/5"
                >
                  Review Application
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-white/5">
        <div className="text-xs font-bold uppercase tracking-widest text-slate-400">
          Page {page} of {Math.ceil(total / pageSize) || 1}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onPrevPage}
            disabled={page === 1}
            className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-600 dark:text-slate-300 disabled:opacity-40 transition hover:bg-slate-50 dark:hover:bg-white/10 shadow-sm"
          >
            Prev
          </button>
          <button
            type="button"
            onClick={onNextPage}
            disabled={offset + pageSize >= total}
            className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-600 dark:text-slate-300 disabled:opacity-40 transition hover:bg-slate-50 dark:hover:bg-white/10 shadow-sm"
          >
            Next
          </button>
        </div>
      </div>
    </>
  );
}
