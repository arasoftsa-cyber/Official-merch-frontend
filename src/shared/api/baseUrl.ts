const DEFAULT_API_BASE = 'http://localhost:3000';

const normalizeBase = (value: string): string => {
  let normalized = value.trim();
  if (normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }
  if (normalized.endsWith('/api')) {
    normalized = normalized.slice(0, normalized.length - 4);
  }
  return normalized;
};

export function getApiBaseUrl(): string {
  const envBase =
    (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() ||
    (import.meta.env.VITE_API_URL as string | undefined)?.trim() ||
    (import.meta.env.VITE_API_BASE as string | undefined)?.trim() ||
    (import.meta.env.REACT_APP_API_BASE_URL as string | undefined)?.trim();

  return envBase && envBase.length > 0 ? normalizeBase(envBase) : DEFAULT_API_BASE;
}

export const API_BASE = getApiBaseUrl();
