import { getAccessToken } from '../auth/tokenStore';
import API_BASE_CONFIG from '@/config/apiBase';
import { validateApiResponse } from '../validation/schemas';
import { createRefreshFlow, shouldRetryAfter401 } from './authRefreshFlow';
export const API_BASE = String(API_BASE_CONFIG || '').trim().replace(/\/+$/, '');
const NETWORK_ERROR_MESSAGE =
  'Cannot reach the server. Make sure the backend is running and your API base URL is correct.';
type ApiRequestOptions = RequestInit & {
  schema?: any;
  __retryCount?: number;
  __skipAuthRefresh?: boolean;
};

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

const isLikelyNetworkError = (err: unknown): boolean => {
  const message = String((err as any)?.message || err || '').toLowerCase();
  if (message.includes('failed to fetch')) return true;
  if (message.includes('networkerror')) return true;
  if (message.includes('err_connection_refused')) return true;
  if (message.includes('network request failed')) return true;
  return false;
};

const refreshFlow = createRefreshFlow((path, options) =>
  apiFetchInternal(path, options as ApiRequestOptions)
);

async function apiFetchInternal(
  path: string,
  options: ApiRequestOptions = {}
): Promise<any> {
  const endpoint = ensureApiPath(path);
  const retryCount = Number(options.__retryCount || 0);
  const skipAuthRefresh = Boolean(options.__skipAuthRefresh);
  if (import.meta.env.DEV && endpoint.includes('/api/api/')) {
    // eslint-disable-next-line no-console
    console.warn('Double /api/ detected in API request', path);
  }
  const url = `${API_BASE}${endpoint}`;
  const init: RequestInit = { ...options };
  delete (init as any).schema;
  delete (init as any).__retryCount;
  delete (init as any).__skipAuthRefresh;
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
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch (err: any) {
    if (isLikelyNetworkError(err)) {
      const networkError = new Error(NETWORK_ERROR_MESSAGE);
      (networkError as any).status = 0;
      (networkError as any).code = 'network_error';
      throw networkError;
    }
    throw err;
  }
  const contentType = response.headers.get('content-type') ?? '';
  let payload: any = null;

  if (contentType.includes('application/json')) {
    payload = await response.json().catch(() => null);
    if (options?.schema) {
      payload = validateApiResponse(options.schema, payload);
    }
  } else {
    const text = await response.text().catch(() => null);
    payload = text ? { message: text } : null;
  }

  if (!response.ok) {
    if (!skipAuthRefresh && shouldRetryAfter401({
      endpoint,
      status: response.status,
      payload,
      retryCount,
    })) {
      const refreshedToken = await refreshFlow.refreshAccessToken();
      if (refreshedToken) {
        return apiFetchInternal(path, {
          ...options,
          __retryCount: retryCount + 1,
        });
      }
      refreshFlow.clearSessionOnce();
    }

    const message =
      payload?.error || payload?.message || `HTTP_${response.status}`;
    const error = new Error(message);
    (error as any).status = response.status;
    (error as any).details = payload?.details;
    (error as any).payload = payload;
    throw error;
  }

  return payload;
}

export async function apiFetch(
  path: string,
  options: ApiRequestOptions = {}
): Promise<any> {
  return apiFetchInternal(path, {
    ...options,
    __retryCount: Number(options.__retryCount || 0),
  });
}

export async function apiFetchForm(
  path: string,
  formData: FormData,
  options: Omit<ApiRequestOptions, 'body'> = {}
): Promise<any> {
  return apiFetch(path, {
    ...options,
    body: formData,
  });
}
