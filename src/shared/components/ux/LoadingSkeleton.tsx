import React from 'react';
import { cn } from '../../ui/cn';

type LoadingSkeletonProps = {
  count?: number;
  className?: string;
};

export default function LoadingSkeleton({ count = 3, className }: LoadingSkeletonProps) {
  return (
    <div
      className={cn(
        'grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3',
        className ?? ''
      )}
    >
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={`loading-skeleton-${index}`}
          className="animate-pulse rounded-2xl bg-white/5 p-5 ring-1 ring-white/10"
        >
          <div className="mb-4 h-44 w-full rounded-xl bg-white/10" />
          <div className="mb-3 h-4 w-3/4 rounded bg-white/30" />
          <div className="mb-4 h-3 w-1/2 rounded bg-white/20" />
          <div className="flex items-center justify-between text-xs uppercase tracking-[0.4em] text-slate-400">
            <div className="h-6 w-20 rounded-full bg-white/15" />
            <div className="h-6 w-10 rounded-full bg-white/15" />
          </div>
        </div>
      ))}
    </div>
  );
}
