import React from 'react';
import { formatStatus } from '../../artistRequests/adminArtistRequestsApi';

type AdminArtistRequestStatusChipProps = {
  status: string;
};

export default function AdminArtistRequestStatusChip({ status }: AdminArtistRequestStatusChipProps) {
  return (
    <span
      className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest ring-1 ring-inset ${status === 'approved'
        ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-emerald-500/20'
        : status === 'rejected'
          ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 ring-rose-500/20'
          : 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-amber-500/20'
        }`}
    >
      {formatStatus(status)}
    </span>
  );
}
