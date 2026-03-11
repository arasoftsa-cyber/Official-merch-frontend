import React from 'react';

type AdminArtistRequestsIntroProps = {
  subtitle?: string;
};

export default function AdminArtistRequestsIntro({ subtitle }: AdminArtistRequestsIntroProps) {
  return (
    <div className="space-y-1">
      <p className="text-xs uppercase tracking-[0.4em] text-slate-500 dark:text-slate-400">Admin</p>
      <h1 className="text-3xl font-semibold text-slate-900 dark:text-white">Artist Requests</h1>
      {subtitle && <p className="text-xs text-slate-600 dark:text-white/60">{subtitle}</p>}
    </div>
  );
}
