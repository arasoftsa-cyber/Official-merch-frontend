import React from 'react';

type PageProps = {
  children: React.ReactNode;
};

type ContainerProps = {
  children: React.ReactNode;
  className?: string;
};

type CardProps = {
  children: React.ReactNode;
  className?: string;
};

export function Page({ children }: PageProps) {
  return <div className="min-h-screen bg-slate-950 text-slate-100">{children}</div>;
}

export function Container({ children, className }: ContainerProps) {
  return (
    <div className={`max-w-6xl mx-auto px-4 py-8 ${className ?? ''}`}>{children}</div>
  );
}

export function Card({ children, className }: CardProps) {
  return (
    <div className={`rounded-2xl bg-white/5 ring-1 ring-white/10 ${className ?? ''}`}>{children}</div>
  );
}
