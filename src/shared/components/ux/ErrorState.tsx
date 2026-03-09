import React from 'react';

type ErrorStateProps = {
  message?: string;
  onRetry?: () => void;
};

export default function ErrorState({ message = 'Something went wrong.', onRetry }: ErrorStateProps) {
  return (
    <div
      style={{
        padding: '1rem',
        background: '#2b0000',
        borderRadius: 10,
        border: '1px solid rgba(255,0,0,0.4)',
        color: '#fff',
      }}
    >
      <p style={{ margin: 0 }}>{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          style={{
            marginTop: '0.5rem',
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.5)',
            borderRadius: 999,
            padding: '0.25rem 0.75rem',
            color: '#fff',
            cursor: 'pointer',
          }}
        >
          Retry
        </button>
      )}
    </div>
  );
}
