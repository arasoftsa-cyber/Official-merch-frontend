import React from 'react';

export default function BuyerAddressesPage() {
  return (
    <section className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.4em] text-white/60">Addresses</p>
        <h1 className="text-3xl font-semibold text-white">My Addresses</h1>
        <p className="text-sm text-white/70">
          Add shipping addresses for faster checkout and easier returns.
        </p>
      </div>
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center text-sm text-white/70">
        <p className="mb-4">You have not saved any addresses yet.</p>
        <button
          type="button"
          disabled
          className="rounded-full border border-white/20 px-4 py-2 text-xs uppercase tracking-[0.3em] text-white/40"
        >
          Add address
        </button>
      </div>
    </section>
  );
}
