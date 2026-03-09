import React from 'react';

type PublicCatalogHeaderProps = {
  eyebrow: string;
  title: string;
  description: string;
};

export default function PublicCatalogHeader({
  eyebrow,
  title,
  description,
}: PublicCatalogHeaderProps) {
  return (
    <header className="space-y-3">
      <p className="text-xs uppercase tracking-[0.4em] text-slate-600 dark:text-slate-400">{eyebrow}</p>
      <div className="space-y-2">
        <h1 className="text-4xl font-semibold tracking-tight text-slate-900 dark:text-white">{title}</h1>
        <p className="max-w-3xl text-base text-slate-600 dark:text-slate-300">{description}</p>
      </div>
    </header>
  );
}
