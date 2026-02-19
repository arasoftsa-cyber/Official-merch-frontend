import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

type ToastTone = 'info' | 'success' | 'error';

type Toast = {
  id: string;
  message: string;
  tone: ToastTone;
};

type ToastContextValue = {
  notify: (message: string, tone?: ToastTone) => void;
};

const ToastContext = createContext<ToastContextValue>({
  notify: () => undefined,
});

export const useToast = () => useContext(ToastContext);

const buildId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export const ToastProvider = ({ children }: { children: React.ReactNode }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const notify = useCallback((message: string, tone: ToastTone = 'info') => {
    const id = buildId();
    setToasts((current) => [...current, { id, message, tone }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ notify }}>
      {children}
      <ToastHost toasts={toasts} />
    </ToastContext.Provider>
  );
};

export const ToastHost = ({ toasts }: { toasts: Toast[] }) => {
  if (!toasts.length) {
    return null;
  }

  return (
    <div
      aria-live="polite"
      style={{
        position: 'fixed',
        bottom: 16,
        right: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        zIndex: 999,
      }}
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          style={{
            padding: '0.75rem 1rem',
            borderRadius: 10,
            minWidth: 200,
            background:
              toast.tone === 'success'
                ? '#065f46'
                : toast.tone === 'error'
                ? '#7f1d1d'
                : '#111',
            color: '#fff',
            boxShadow: '0 0 10px rgba(0,0,0,0.5)',
          }}
        >
          {toast.message}
        </div>
      ))}
    </div>
  );
};
