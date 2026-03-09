import React from 'react';
import { Link } from 'react-router-dom';
import PublicCardCover from './PublicCardCover';

type PublicCatalogCardProps = {
  kind: 'artist' | 'drop' | 'product';
  title: string;
  subtitle?: string;
  description?: string;
  imageUrl?: string;
  imageAlt?: string;
  href?: string;
  ctaLabel: string;
  unavailableLabel?: string;
  testId?: string;
};

const baseCardClass =
  'overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-white/5';

export default function PublicCatalogCard({
  kind,
  title,
  subtitle,
  description,
  imageUrl,
  imageAlt,
  href,
  ctaLabel,
  unavailableLabel = 'Unavailable',
  testId = 'public-catalog-card',
}: PublicCatalogCardProps) {
  const content = (
    <>
      <PublicCardCover
        title={title}
        subtitle={subtitle}
        imageUrl={imageUrl}
        imageAlt={imageAlt ?? `${title} cover`}
        kind={kind}
        className="h-36 w-full rounded-none"
      />
      <div className="space-y-1 p-4">
        <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{title}</p>
        {subtitle ? <p className="truncate text-xs text-slate-600 dark:text-slate-400">{subtitle}</p> : null}
        {description ? (
          <p className="line-clamp-2 text-xs text-slate-600 dark:text-slate-400">{description}</p>
        ) : null}
        <p className="pt-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-white/80">
          {href ? ctaLabel : unavailableLabel}
        </p>
      </div>
    </>
  );

  if (href) {
    return (
      <Link
        to={href}
        data-testid={testId}
        className={`${baseCardClass} transition hover:border-slate-300 dark:hover:border-white/30`}
      >
        {content}
      </Link>
    );
  }

  return (
    <article data-testid={testId} className={`${baseCardClass} opacity-80`}>
      {content}
    </article>
  );
}
