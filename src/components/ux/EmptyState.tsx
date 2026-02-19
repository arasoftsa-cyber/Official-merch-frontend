import React from 'react';

type EmptyStateProps = {
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: React.ReactNode;
};

export default function EmptyState({
  title,
  message,
  actionLabel,
  onAction,
  icon,
}: EmptyStateProps) {
  return (
    <div
      style={{
        background: '#111',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 12,
        padding: '1.5rem',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '0.75rem',
        textAlign: 'center',
      }}
    >
      {icon && <div>{icon}</div>}
      <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>{title}</h3>
      {message && (
        <p style={{ margin: 0, fontSize: '0.95rem', color: '#bbb', maxWidth: 320 }}>{message}</p>
      )}
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          style={{
            border: '1px solid rgba(255,255,255,0.3)',
            background: 'transparent',
            color: '#fff',
            borderRadius: 999,
            padding: '0.4rem 1.5rem',
            cursor: 'pointer',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            fontSize: '0.8rem',
          }}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
