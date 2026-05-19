import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { ConfirmDialog } from './ConfirmDialog';

export type ConfirmOptions = {
  title?: string;
  message: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
};

type ConfirmRequest = {
  id: string;
  options: ConfirmOptions;
  resolve: (value: boolean) => void;
};

type ConfirmContextValue = {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
};

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

const buildRequestId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export function ConfirmProvider({ children }: React.PropsWithChildren) {
  const [activeRequest, setActiveRequest] = useState<ConfirmRequest | null>(null);
  const activeRequestRef = useRef<ConfirmRequest | null>(null);
  const queueRef = useRef<ConfirmRequest[]>([]);

  useEffect(() => {
    activeRequestRef.current = activeRequest;
  }, [activeRequest]);

  useEffect(() => {
    if (activeRequest || queueRef.current.length === 0) {
      return;
    }

    const nextRequest = queueRef.current.shift() ?? null;
    if (!nextRequest) {
      return;
    }

    activeRequestRef.current = nextRequest;
    setActiveRequest(nextRequest);
  }, [activeRequest]);

  useEffect(() => {
    return () => {
      activeRequestRef.current?.resolve(false);
      queueRef.current.forEach((request) => request.resolve(false));
      activeRequestRef.current = null;
      queueRef.current = [];
    };
  }, []);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      const request: ConfirmRequest = {
        id: buildRequestId(),
        options,
        resolve,
      };

      if (activeRequestRef.current) {
        queueRef.current.push(request);
        return;
      }

      activeRequestRef.current = request;
      setActiveRequest(request);
    });
  }, []);

  const closeActiveRequest = useCallback((confirmed: boolean) => {
    const request = activeRequestRef.current;
    if (!request) return;

    activeRequestRef.current = null;
    setActiveRequest(null);
    request.resolve(confirmed);
  }, []);

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {activeRequest && (
        <ConfirmDialog
          key={activeRequest.id}
          open
          title={activeRequest.options.title}
          message={activeRequest.options.message}
          confirmText={activeRequest.options.confirmText}
          cancelText={activeRequest.options.cancelText}
          danger={activeRequest.options.danger}
          onCancel={() => closeActiveRequest(false)}
          onConfirm={() => closeActiveRequest(true)}
        />
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error('useConfirm must be used within a ConfirmProvider');
  }
  return context;
}
