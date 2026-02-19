import { getAccessToken } from '../auth/tokenStore';

const envBase =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() ||
  (import.meta.env.REACT_APP_API_BASE_URL as string | undefined)?.trim() ||
  (import.meta.env.VITE_API_URL as string | undefined)?.trim();

const normalizeBase = (value: string): string => {
  let normalized = value;
  if (normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }
  if (normalized.endsWith('/api')) {
    normalized = normalized.slice(0, normalized.length - 4);
  }
  return normalized;
};

const DEFAULT_API_BASE = 'http://127.0.0.1:3000';
export const API_BASE =
  envBase && envBase.length > 0 ? normalizeBase(envBase) : DEFAULT_API_BASE;

const ensureApiPath = (path: string) => {
  const trimmed = path.trim();
  if (trimmed.startsWith('/api/')) {
    return trimmed;
  }
  const withLeading = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return `/api${withLeading}`;
};

function isPlainObject(value: any): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === 'object' &&
    !(value instanceof FormData) &&
    !(value instanceof URLSearchParams)
  );
}

export async function apiFetch(
  path: string,
  options: RequestInit = {}
): Promise<any> {
  const endpoint = ensureApiPath(path);
  if (import.meta.env.DEV && endpoint.includes('/api/api/')) {
    // eslint-disable-next-line no-console
    console.warn('Double /api/ detected in API request', path);
  }
  const url = `${API_BASE}${endpoint}`;
  const init: RequestInit = { ...options };
  const headers = new Headers(init.headers ?? {});
  headers.set('Accept', 'application/json');
  const token = getAccessToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (init.body && isPlainObject(init.body)) {
    headers.set('Content-Type', 'application/json');
    init.body = JSON.stringify(init.body);
  }

  init.headers = headers;
  const response = await fetch(url, init);
  const contentType = response.headers.get('content-type') ?? '';
  let payload: any = null;

  if (contentType.includes('application/json')) {
    payload = await response.json().catch(() => null);
  } else {
    const text = await response.text().catch(() => null);
    payload = text ? { message: text } : null;
  }

  if (!response.ok) {
    const message =
      payload?.error || payload?.message || `HTTP_${response.status}`;
    const error = new Error(message);
    (error as any).status = response.status;
    throw error;
  }

  return payload;
}
