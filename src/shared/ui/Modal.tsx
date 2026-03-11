import React, { useEffect, useId, useRef } from 'react';

type ModalProps = {
  open: boolean;
  title?: string;
  children: React.ReactNode;
  onClose: () => void;
  footer?: React.ReactNode;
};

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const getFocusableElements = (root: HTMLElement | null): HTMLElement[] => {
  if (!root) return [];
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (node) => !node.hasAttribute('disabled') && node.tabIndex !== -1 && node.offsetParent !== null
  );
};

export function Modal({ open, title, children, onClose, footer }: ModalProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const generatedId = useId();
  const titleId = title ? `${generatedId}-title` : undefined;

  useEffect(() => {
    if (!open) return;
    previouslyFocusedRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const panel = panelRef.current;
    const focusable = getFocusableElements(panel);
    if (focusable.length > 0) {
      focusable[0].focus();
    } else {
      panel?.focus();
    }

    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;

      const currentPanel = panelRef.current;
      if (!currentPanel) return;
      const nodes = getFocusableElements(currentPanel);
      if (nodes.length === 0) {
        event.preventDefault();
        currentPanel.focus();
        return;
      }

      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (event.shiftKey) {
        if (!active || active === first || !currentPanel.contains(active)) {
          event.preventDefault();
          last.focus();
        }
        return;
      }

      if (!active || active === last || !currentPanel.contains(active)) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handler);
    return () => {
      document.removeEventListener('keydown', handler);
      const previous = previouslyFocusedRef.current;
      if (previous && typeof previous.focus === 'function') {
        previous.focus();
      }
      previouslyFocusedRef.current = null;
    };
  }, [open, onClose]);

  if (!open) return null;

  const handleBackdropClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (panelRef.current && panelRef.current.contains(event.target as Node)) {
      return;
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center"
      role="presentation"
      onClick={handleBackdropClick}
    >
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="relative z-10 mx-4 w-full max-w-lg rounded-2xl bg-slate-950 ring-1 ring-white/10 shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
          {title && (
            <h2 id={titleId} className="text-lg font-semibold tracking-tight text-white">
              {title}
            </h2>
          )}
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="rounded-full bg-white/10 px-3 py-1 text-sm font-semibold text-white transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300/60"
          >
            ×
          </button>
        </div>
        <div className="px-5 py-6 text-sm text-slate-100">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2 border-t border-white/10 px-4 py-3">{footer}</div>
        )}
      </div>
    </div>
  );
}

