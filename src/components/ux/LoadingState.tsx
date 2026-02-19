import React from 'react';

type LoadingStateProps = {
  message?: string;
};

export default function LoadingState({ message = 'Loading…' }: LoadingStateProps) {
  return (
    <div
      style={{
        padding: '1rem',
        background: '#151515',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 10,
        color: '#fff',
      }}
    >
      <p style={{ margin: 0 }}>{message}</p>
    </div>
  );
}
