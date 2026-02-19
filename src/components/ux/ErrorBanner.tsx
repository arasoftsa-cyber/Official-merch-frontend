import React from 'react';
import { cn } from '../../ui/cn';

type ErrorBannerProps = {
  message: string;
  className?: string;
  onRetry?: () => void;
};

export default function ErrorBanner({ message, className, onRetry }: ErrorBannerProps) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-rose-500/60 bg-rose-500/10 p-4 text-sm text-rose-100',
        className ?? ''
      )}
      role="alert"
    >
      <p className="mb-2">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="om-btn om-focus inline-flex items-center gap-2 rounded-full border border-white/30 px-3 py-1 text-xs uppercase tracking-[0.3em] text-white transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300/80"
        >
          Retry
        </button>
      )}
    </div>
  );
}
