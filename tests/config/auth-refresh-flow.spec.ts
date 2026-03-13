import { expect, test } from '@playwright/test';
import { readFileSync } from 'fs';
import {
  createRefreshFlow,
  shouldRetryAfter401,
} from '../../src/shared/api/authRefreshFlow';
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  setAccessToken,
  setRefreshToken,
} from '../../src/shared/auth/tokenStore';
import { resolveFrontendPathFromTest } from '../helpers/repoPaths';

test.describe('auth refresh flow', () => {
  test.beforeEach(() => {
    clearTokens();
  });

  test('concurrent refresh attempts share one in-flight promise', async () => {
    setRefreshToken('refresh-token-1');
    let refreshCalls = 0;
    const refreshFlow = createRefreshFlow(async () => {
      refreshCalls += 1;
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 5));
      return {
        accessToken: 'next-access-token',
        refreshToken: 'next-refresh-token',
      };
    });

    const [a, b, c] = await Promise.all([
      refreshFlow.refreshAccessToken(),
      refreshFlow.refreshAccessToken(),
      refreshFlow.refreshAccessToken(),
    ]);

    expect(refreshCalls).toBe(1);
    expect(a).toBe('next-access-token');
    expect(b).toBe('next-access-token');
    expect(c).toBe('next-access-token');
    expect(getAccessToken()).toBe('next-access-token');
    expect(getRefreshToken()).toBe('next-refresh-token');
  });

  test('retry policy allows one retry for auth-expiry 401 then stops', () => {
    expect(
      shouldRetryAfter401({
        endpoint: '/api/auth/whoami',
        status: 401,
        payload: { error: 'unauthorized' },
        retryCount: 0,
      })
    ).toBe(true);

    expect(
      shouldRetryAfter401({
        endpoint: '/api/auth/whoami',
        status: 401,
        payload: { error: 'unauthorized' },
        retryCount: 1,
      })
    ).toBe(false);

    expect(
      shouldRetryAfter401({
        endpoint: '/api/auth/whoami',
        status: 401,
        payload: { error: 'invalid_credentials' },
        retryCount: 0,
      })
    ).toBe(false);
  });

  test('failed refresh clears auth state and does not loop', async () => {
    setAccessToken('stale-access-token');
    setRefreshToken('stale-refresh-token');
    let refreshCalls = 0;
    const refreshFlow = createRefreshFlow(async () => {
      refreshCalls += 1;
      throw new Error('refresh failed');
    });

    const first = await refreshFlow.refreshAccessToken();
    const second = await refreshFlow.refreshAccessToken();

    expect(first).toBeNull();
    expect(second).toBeNull();
    expect(refreshCalls).toBe(1);
    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
  });

  test('refresh endpoint 401 is not retryable', () => {
    expect(
      shouldRetryAfter401({
        endpoint: '/api/auth/refresh',
        status: 401,
        payload: { error: 'unauthorized' },
        retryCount: 0,
      })
    ).toBe(false);
  });

  test('non-canonical refresh payload is treated as terminal auth failure', async () => {
    setAccessToken('stale-access-token');
    setRefreshToken('stale-refresh-token');
    const refreshFlow = createRefreshFlow(async () => {
      return {
        token: 'legacy-access-token',
        refresh_token: 'legacy-refresh-token',
      };
    });

    const result = await refreshFlow.refreshAccessToken();
    expect(result).toBeNull();
    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
  });

  test('App.tsx no longer contains refresh orchestration', () => {
    const appPath = resolveFrontendPathFromTest(test.info().file, 'src', 'app', 'App.tsx');
    const source = readFileSync(appPath, 'utf8');
    expect(source.includes('/api/auth/refresh')).toBe(false);
    expect(source.includes('ensureSessionForProtectedRoute')).toBe(false);
  });
});
