import React from 'react';

type KpiCardProps = {
  label: string;
  value: React.ReactNode;
  hint?: string;
  valueClassName?: string;
};

export default function KpiCard({ label, value, hint, valueClassName }: KpiCardProps) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5 shadow-sm">
      <p className="text-xs uppercase tracking-[0.35em] text-white/60">{label}</p>
      <p className={`mt-2 text-3xl font-semibold text-white ${valueClassName ?? ''}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-white/40">{hint}</p>}
    </div>
  );
}
