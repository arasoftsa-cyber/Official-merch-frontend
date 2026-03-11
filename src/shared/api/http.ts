import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  setAccessToken,
  setRefreshToken,
} from '../auth/tokenStore';
import API_BASE_CONFIG from '@/config/apiBase';
import { validateApiResponse } from '../validation/schemas';
export const API_BASE = String(API_BASE_CONFIG || '').trim().replace(/\/+$/, '');
const AUTH_REFRESH_ENDPOINT = '/api/auth/refresh';
const NETWORK_ERROR_MESSAGE =
  'Cannot reach the server. Make sure the backend is running and your API base URL is correct.';
type ApiRequestOptions = RequestInit & { schema?: any };
const LOGIN_OR_REGISTER_PATH_RE = /^\/(fan|partner)\/(login|register)(?:\/|$)/i;

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

const getAccessTokenFromPayload = (payload: any): string | null => {
  return (
    payload?.accessToken ||
    payload?.token ||
    payload?.data?.accessToken ||
    payload?.access_token ||
    null
  );
};

const getRefreshTokenFromPayload = (payload: any): string | null => {
  return (
    payload?.refreshToken ||
    payload?.data?.refreshToken ||
    payload?.refresh_token ||
    null
  );
};

let refreshInFlight: Promise<string | null> | null = null;

const refreshAccessToken = async (): Promise<string | null> => {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const refreshToken = getRefreshToken();
      if (!refreshToken) {
        return null;
      }

      let payload: any = null;
      try {
        payload = await apiFetchInternal(
          AUTH_REFRESH_ENDPOINT,
          { method: 'POST', body: { refreshToken } },
          false
        );
      } catch (err: any) {
        if (Number(err?.status || 0) === 401) {
          return null;
        }
        return null;
      }

      const token = getAccessTokenFromPayload(payload);
      if (token) {
        setAccessToken(token);
      }
      const rotatedRefreshToken = getRefreshTokenFromPayload(payload);
      if (rotatedRefreshToken) {
        setRefreshToken(rotatedRefreshToken);
      }
      return token;
    })().finally(() => {
      refreshInFlight = null;
    });
  }

  return refreshInFlight;
};

async function apiFetchInternal(
  path: string,
  options: ApiRequestOptions = {},
  allowRefresh = true
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
    const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
    const shouldSkipRefresh = LOGIN_OR_REGISTER_PATH_RE.test(currentPath);
    if (
      response.status === 401 &&
      allowRefresh &&
      endpoint !== AUTH_REFRESH_ENDPOINT &&
      !shouldSkipRefresh
    ) {
      const refreshedToken = await refreshAccessToken();
      if (refreshedToken) {
        return apiFetchInternal(path, options, false);
      }
      clearTokens();
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
  return apiFetchInternal(path, options, true);
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
