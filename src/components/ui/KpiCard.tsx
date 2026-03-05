import React from 'react';

type KpiCardProps = {
  label: string;
  value: React.ReactNode;
  hint?: string;
  valueClassName?: string;
};

export default function KpiCard({ label, value, hint, valueClassName }: KpiCardProps) {
  return (
    <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 p-5 shadow-sm">
      <p className="text-xs uppercase tracking-[0.35em] text-slate-500 dark:text-white/60">{label}</p>
      <p className={`mt-2 text-3xl font-semibold text-slate-900 dark:text-white ${valueClassName ?? ''}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-400 dark:text-white/40">{hint}</p>}
    </div>
  );
}
