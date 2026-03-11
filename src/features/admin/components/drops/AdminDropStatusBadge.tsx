import React from 'react';

type AdminDropStatusBadgeProps = {
  status: string;
};

export default function AdminDropStatusBadge({ status }: AdminDropStatusBadgeProps) {
  return (
    <span
      className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest ${status === 'published'
        ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400'
        : status === 'draft'
          ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400'
          : 'bg-slate-100 dark:bg-slate-500/20 text-slate-700 dark:text-slate-400'
        }`}
    >
      {status}
    </span>
  );
}
