import React from 'react';

type PageProps = {
  children: React.ReactNode;
  className?: string;
};

type ContainerProps = {
  children: React.ReactNode;
  className?: string;
};

type CardProps = {
  children: React.ReactNode;
  className?: string;
};

export function Page({ children, className }: PageProps) {
  return <div className={`min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 ${className ?? ''}`}>{children}</div>;
}

export function Container({ children, className }: ContainerProps) {
  return (
    <div className={`max-w-6xl mx-auto px-4 py-8 ${className ?? ''}`}>{children}</div>
  );
}

export function Card({ children, className }: CardProps) {
  return (
    <div className={`rounded-2xl bg-slate-50 dark:bg-white/5 ring-1 ring-slate-200 dark:ring-white/10 ${className ?? ''}`}>{children}</div>
  );
}
