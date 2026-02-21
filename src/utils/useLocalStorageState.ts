import { useCallback, useEffect, useState } from 'react';

export function loadInitialState<T>(key: string, defaultValue: T): T {
  if (typeof window === 'undefined') return defaultValue;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return defaultValue;
    const parsed = JSON.parse(raw);
    if (parsed == null || typeof parsed !== 'object') return defaultValue;
    if (defaultValue != null && typeof defaultValue === 'object') {
      return { ...(defaultValue as any), ...(parsed as any) };
    }
    return parsed as T;
  } catch {
    return defaultValue;
  }
}

export function useLocalStorageState<T extends Record<string, any>>(
  key: string,
  defaultValue: T,
  debounceMs = 200
) {
  const [state, setState] = useState<T>(() => loadInitialState(key, defaultValue));

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const timer = window.setTimeout(() => {
      try {
        window.localStorage.setItem(key, JSON.stringify(state));
      } catch {
        // Ignore storage write failures.
      }
    }, debounceMs);
    return () => window.clearTimeout(timer);
  }, [debounceMs, key, state]);

  const setStateAndPersist = useCallback(
    (partial: Partial<T> | ((prev: T) => Partial<T>)) => {
      setState((prev) => {
        const nextPartial =
          typeof partial === 'function' ? (partial as (prev: T) => Partial<T>)(prev) : partial;
        return { ...prev, ...nextPartial };
      });
    },
    []
  );

  const clearPersisted = useCallback(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Ignore storage cleanup failures.
    }
  }, [key]);

  return { state, setState, setStateAndPersist, clearPersisted };
}
