import React from 'react';

type AppShellProps = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
};

export default function AppShell({ title, subtitle, children }: AppShellProps) {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="flex min-h-screen flex-col">
        <div className="mx-auto w-full max-w-6xl px-6 py-10 space-y-8">
          <header className="space-y-2">
            <p className="text-xs uppercase tracking-[0.4em] text-slate-400">
              OfficialMerch
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
            {subtitle && <p className="text-sm text-slate-400">{subtitle}</p>}
          </header>
          <section className="flex flex-col gap-6 overflow-y-auto pb-16">
            {children}
          </section>
        </div>
      </div>
    </main>
  );
}
