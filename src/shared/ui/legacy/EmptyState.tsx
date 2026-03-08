import React from 'react';
import Card from './Card';

type EmptyStateProps = {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
};

export default function EmptyState({ title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <Card className="flex flex-col gap-3 px-6 py-5 text-center text-slate-300">
      <p className="text-base font-semibold text-white">{title}</p>
      {description && <p className="text-sm">{description}</p>}
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mx-auto rounded-full border border-white/20 px-5 py-2 text-xs uppercase tracking-[0.3em] text-white hover:bg-white/10"
        >
          {actionLabel}
        </button>
      )}
    </Card>
  );
}
