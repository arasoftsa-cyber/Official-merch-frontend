import React, { useEffect, useState } from 'react';

type PublicCardCoverProps = {
  title: string;
  subtitle?: string;
  imageUrl?: string;
  imageAlt?: string;
  kind: 'artist' | 'drop';
  className?: string;
};

const getInitials = (value: string) => {
  const words = value
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[1][0]}`.toUpperCase();
};

export default function PublicCardCover({
  title,
  subtitle,
  imageUrl,
  imageAlt,
  kind,
  className,
}: PublicCardCoverProps) {
  const [hasImageError, setHasImageError] = useState(false);

  useEffect(() => {
    setHasImageError(false);
  }, [imageUrl]);

  const fallbackText = kind === 'drop' ? 'DROP' : getInitials(title);
  const gradientClass =
    kind === 'artist'
      ? 'bg-gradient-to-br from-emerald-500/35 via-cyan-500/25 to-slate-700/40'
      : 'bg-gradient-to-br from-fuchsia-500/35 via-indigo-500/25 to-slate-700/40';

  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-white/10 ${className ?? 'aspect-[16/9] w-full'}`}
      aria-label={subtitle ? `${title} ${subtitle}` : title}
    >
      {imageUrl && !hasImageError ? (
        <img
          src={imageUrl}
          alt={imageAlt ?? title}
          loading="lazy"
          decoding="async"
          onError={() => setHasImageError(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <div
          className={`flex h-full w-full items-center justify-center ${gradientClass}`}
          aria-hidden="true"
        >
          <span className="text-2xl font-semibold uppercase tracking-[0.18em] text-white/90">
            {fallbackText}
          </span>
        </div>
      )}
    </div>
  );
}
