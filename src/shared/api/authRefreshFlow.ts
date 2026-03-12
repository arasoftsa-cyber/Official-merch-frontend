import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  setAccessToken,
  setRefreshToken,
} from '../auth/tokenStore';

export const AUTH_REFRESH_ENDPOINT = '/api/auth/refresh';
export const MAX_AUTH_RETRY_COUNT = 1;

const AUTH_EXPIRY_ERROR_CODES = new Set([
  'unauthorized',
]);

const NON_RETRYABLE_AUTH_ENDPOINTS = new Set([
  '/api/auth/refresh',
  '/api/auth/login',
  '/api/auth/fan/login',
  '/api/auth/partner/login',
  '/api/auth/register',
  '/api/auth/logout',
  '/api/auth/password/forgot',
  '/api/auth/password/reset',
]);

type RefreshRequest = (path: string, options: Record<string, unknown>) => Promise<any>;

const getAccessTokenFromPayload = (payload: any): string | null => {
  return payload?.accessToken || null;
};

const getRefreshTokenFromPayload = (payload: any): string | null => {
  return payload?.refreshToken || null;
};

const clearSessionOnce = () => {
  if (!getAccessToken() && !getRefreshToken()) return;
  clearTokens();
};

export const shouldRetryAfter401 = ({
  endpoint,
  status,
  payload,
  retryCount,
}: {
  endpoint: string;
  status: number;
  payload: any;
  retryCount: number;
}): boolean => {
  if (status !== 401) return false;
  if (retryCount >= MAX_AUTH_RETRY_COUNT) return false;
  if (NON_RETRYABLE_AUTH_ENDPOINTS.has(endpoint)) return false;
  const errorCode = String(payload?.error || '').trim().toLowerCase();
  return AUTH_EXPIRY_ERROR_CODES.has(errorCode);
};

export function createRefreshFlow(send: RefreshRequest) {
  let refreshInFlight: Promise<string | null> | null = null;

  const refreshAccessToken = async (): Promise<string | null> => {
    if (!refreshInFlight) {
      refreshInFlight = (async () => {
        const refreshToken = getRefreshToken();
        if (!refreshToken) {
          clearSessionOnce();
          return null;
        }

        let payload: any = null;
        try {
          payload = await send(AUTH_REFRESH_ENDPOINT, {
            method: 'POST',
            body: { refreshToken },
            __skipAuthRefresh: true,
            __retryCount: 0,
          });
        } catch {
          clearSessionOnce();
          return null;
        }

        const nextAccessToken = getAccessTokenFromPayload(payload);
        if (!nextAccessToken) {
          clearSessionOnce();
          return null;
        }

        setAccessToken(nextAccessToken);
        const nextRefreshToken = getRefreshTokenFromPayload(payload);
        if (nextRefreshToken) {
          setRefreshToken(nextRefreshToken);
        }
        return nextAccessToken;
      })().finally(() => {
        refreshInFlight = null;
      });
    }

    return refreshInFlight;
  };

  return {
    refreshAccessToken,
    clearSessionOnce,
  };
}
