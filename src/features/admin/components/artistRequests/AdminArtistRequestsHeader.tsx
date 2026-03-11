import React from 'react';
import { STATUS_LABELS, type StatusOption } from '../../artistRequests/types';
import AdminArtistRequestsIntro from './AdminArtistRequestsIntro';

type AdminArtistRequestsHeaderProps = {
  statusFilter: StatusOption;
  total: number;
  onStatusFilterChange: (value: StatusOption) => void;
};

export default function AdminArtistRequestsHeader({
  statusFilter,
  total,
  onStatusFilterChange,
}: AdminArtistRequestsHeaderProps) {
  return (
    <>
      <AdminArtistRequestsIntro subtitle="Manage incoming artist applications." />

      <div className="flex items-center gap-3">
        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400" htmlFor="status-filter">
          Filter Status
        </label>
        <div className="relative">
          <select
            id="status-filter"
            value={statusFilter}
            onChange={(event) => onStatusFilterChange(event.target.value as StatusOption)}
            className="appearance-none rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 pl-4 pr-10 py-2 text-sm font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 dark:focus:ring-emerald-500/20 focus:outline-none transition shadow-sm cursor-pointer"
          >
            {Object.keys(STATUS_LABELS).map((status) => (
              <option key={status} value={status} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                {STATUS_LABELS[status as StatusOption]}
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
            <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20">
              <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
            </svg>
          </div>
        </div>
        <span className="text-xs font-medium text-slate-500 dark:text-white/60">{total} total requests</span>
      </div>
    </>
  );
}
