import React, { useEffect, useMemo, useState } from 'react';

type HeroBackgroundCarouselProps = {
  images: string[];
  intervalMs?: number;
  className?: string;
};

export default function HeroBackgroundCarousel({
  images,
  intervalMs = 4000,
  className = '',
}: HeroBackgroundCarouselProps) {
  const normalizedImages = useMemo(
    () => images.map((value) => String(value ?? '').trim()).filter(Boolean),
    [images]
  );
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setActiveIndex(0);
  }, [normalizedImages.length]);

  useEffect(() => {
    if (normalizedImages.length <= 1) return undefined;
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % normalizedImages.length);
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs, normalizedImages.length]);

  useEffect(() => {
    if (import.meta.env.DEV && normalizedImages.length === 0) {
      // eslint-disable-next-line no-console
      console.warn('[HeroBackgroundCarousel] no images provided');
    }
  }, [normalizedImages.length]);

  if (normalizedImages.length === 0) return null;

  return (
    <div className={`pointer-events-none absolute inset-0 z-0 bg-black ${className}`} aria-hidden>
      {normalizedImages.map((image, index) => (
        <div
          key={`${image}-${index}`}
          className={`absolute inset-0 scale-[1.03] bg-cover bg-center transition-opacity duration-1000 ease-in-out ${
            index === activeIndex ? 'opacity-100' : 'opacity-0'
          }`}
          style={{ backgroundImage: `url(${image})` }}
        />
      ))}
      <div className="absolute inset-0 bg-black/55 md:bg-black/45" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/45 to-black/70" />
      <div className="absolute inset-0 shadow-[inset_0_0_120px_rgba(0,0,0,0.4)]" />
    </div>
  );
}
