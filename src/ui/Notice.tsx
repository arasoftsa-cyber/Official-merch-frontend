import React from 'react';
import { cn } from './cn';

export type NoticeVariant = 'info' | 'success' | 'warning' | 'error';

type NoticeProps = {
  variant?: NoticeVariant;
  title?: string;
  children?: React.ReactNode;
  className?: string;
};

const variantStyles: Record<NoticeVariant, string> = {
  info: 'bg-indigo-500/10 text-indigo-200 ring-indigo-500/20',
  success: 'bg-emerald-500/10 text-emerald-200 ring-emerald-500/20',
  warning: 'bg-amber-500/10 text-amber-200 ring-amber-500/20',
  error: 'bg-rose-500/10 text-rose-200 ring-rose-500/20',
};

export function Notice({
  variant = 'info',
  title,
  children,
  className,
}: NoticeProps) {
  return (
    <div
      className={cn(
        'rounded-xl px-3 py-2 text-sm ring-1',
        variantStyles[variant],
        className
      )}
      role="status"
      aria-live="polite"
    >
      {title && <p className="text-sm font-semibold">{title}</p>}
      {children && <div className="mt-1">{children}</div>}
    </div>
  );
}
