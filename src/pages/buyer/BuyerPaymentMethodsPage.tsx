import React from 'react';

const methods = [
  { name: 'UPI', status: 'coming soon' },
  { name: 'Card', status: 'coming soon' },
  { name: 'Wallets', status: 'coming soon' },
];

export default function BuyerPaymentMethodsPage() {
  return (
    <section className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.4em] text-white/60">Payment Methods</p>
        <h1 className="text-3xl font-semibold text-white">Payment Methods</h1>
        <p className="text-sm text-white/70">
          Saved methods will be available once we enable a payment provider.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {methods.map((method) => (
          <article key={method.name} className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white/70">
            <h2 className="text-lg font-semibold text-white">{method.name}</h2>
            <p className="mt-2 text-sm uppercase tracking-[0.3em] text-white/40">{method.status}</p>
            <p className="mt-4 text-xs text-white/50">We’ll notify you when this option becomes available.</p>
          </article>
        ))}
      </div>
    </section>
  );
}
