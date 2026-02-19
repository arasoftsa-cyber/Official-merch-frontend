import React, { useEffect, useState } from 'react';
import { CartItem, getCart, removeItem, updateQty, clearCart, subscribeCart } from './cartStore';

type CartDrawerProps = {
  open: boolean;
  onClose: () => void;
};

export function CartDrawer({ open, onClose }: CartDrawerProps) {
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    if (!open) return;
    setItems(getCart());
    const unsub = subscribeCart(() => setItems(getCart()));
    return unsub;
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  const subtotal = items.reduce((sum, item) => sum + item.price * item.qty, 0);

  return (
    <div className="fixed inset-0 z-[70] flex">
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        role="presentation"
        onClick={onClose}
      />
      <aside className="relative z-10 h-full w-full max-w-md bg-slate-950 p-4 ring-1 ring-white/10 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight">Cart</h2>
          <button type="button" onClick={onClose} className="text-sm text-slate-400 hover:text-white">
            Close
          </button>
        </div>
        <div className="mt-4 space-y-4 overflow-y-auto pr-2">
          {items.length === 0 && <p className="text-sm text-slate-300">Cart is empty.</p>}
          {items.map((item) => (
            <div key={item.productId} className="rounded-xl bg-white/5 p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-white">{item.title}</p>
                  <p className="text-xs text-slate-400">
                    ${item.price.toFixed(2)} × {item.qty}
                  </p>
                </div>
                <button
                  type="button"
                  className="text-xs uppercase tracking-[0.3em] text-slate-400"
                  onClick={() => removeItem(item.productId)}
                >
                  Remove
                </button>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => updateQty(item.productId, item.qty - 1)}
                  className="rounded-full border border-white/20 px-2 text-xs uppercase tracking-[0.3em]"
                >
                  -
                </button>
                <span className="text-xs text-slate-200">Qty {item.qty}</span>
                <button
                  type="button"
                  onClick={() => updateQty(item.productId, item.qty + 1)}
                  className="rounded-full border border-white/20 px-2 text-xs uppercase tracking-[0.3em]"
                >
                  +
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 border-t border-white/10 pt-4">
          <p className="om-muted">Subtotal</p>
          <p className="text-lg font-semibold text-white">${subtotal.toFixed(2)}</p>
          <div className="mt-4 flex justify-between gap-2">
            <button
              type="button"
              onClick={onClose}
              className="om-btn om-focus rounded-full border border-white/30 px-4 py-2 text-xs uppercase tracking-[0.3em]"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => alert('Checkout coming soon')}
              className="om-btn om-focus rounded-full bg-indigo-500 px-4 py-2 text-xs uppercase tracking-[0.3em] text-white"
            >
              Checkout
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}
