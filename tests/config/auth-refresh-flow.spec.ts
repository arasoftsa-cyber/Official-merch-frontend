import { expect, test } from '@playwright/test';
import { readFileSync } from 'fs';
import {
  createRefreshFlow,
  shouldRetryAfter401,
} from '../../src/shared/api/authRefreshFlow';
import {
  AUTH_SESSION_STORAGE_KEY,
  __resetSessionStoreForTests,
  clearTokens,
  getAccessToken,
  getRefreshToken,
  loadPersistedSession,
  setAccessToken,
  setSession,
  setRefreshToken,
} from '../../src/shared/auth/tokenStore';
import { resolveFrontendPathFromTest } from '../helpers/repoPaths';

type StorageMock = {
  clear: () => void;
  getItem: (key: string) => string | null;
  removeItem: (key: string) => void;
  setItem: (key: string, value: string) => void;
};

const createSessionStorageMock = (): StorageMock => {
  const store = new Map<string, string>();
  return {
    clear: () => {
      store.clear();
    },
    getItem: (key: string) => {
      return store.has(key) ? store.get(key)! : null;
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    setItem: (key: string, value: string) => {
      store.set(key, String(value));
    },
  };
};

test.describe('auth refresh flow', () => {
  let originalSessionStorage: Storage | undefined;
  let sessionStorageMock: StorageMock;

  test.beforeAll(() => {
    originalSessionStorage = (globalThis as any).sessionStorage;
  });

  test.beforeEach(() => {
    sessionStorageMock = createSessionStorageMock();
    Object.defineProperty(globalThis, 'sessionStorage', {
      configurable: true,
      value: sessionStorageMock,
    });
    clearTokens();
    __resetSessionStoreForTests();
  });

  test.afterAll(() => {
    Object.defineProperty(globalThis, 'sessionStorage', {
      configurable: true,
      value: originalSessionStorage,
    });
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

  test('persisted refresh session survives memory reset and does not persist the access token', () => {
    setSession({
      accessToken: 'access-token-1',
      refreshToken: 'refresh-token-1',
    });

    const persistedRaw = sessionStorageMock.getItem(AUTH_SESSION_STORAGE_KEY);
    expect(persistedRaw).toContain('refresh-token-1');
    expect(persistedRaw).not.toContain('access-token-1');

    __resetSessionStoreForTests();

    expect(getAccessToken()).toBeNull();
    expect(loadPersistedSession().refreshToken).toBe('refresh-token-1');
    expect(getRefreshToken()).toBe('refresh-token-1');
  });

  test('clearing the session removes persisted auth state', () => {
    setSession({
      accessToken: 'access-token-1',
      refreshToken: 'refresh-token-1',
    });

    clearTokens();
    __resetSessionStoreForTests();

    expect(sessionStorageMock.getItem(AUTH_SESSION_STORAGE_KEY)).toBeNull();
    expect(loadPersistedSession().refreshToken).toBeNull();
    expect(getRefreshToken()).toBeNull();
  });

  test('invalid persisted session data is discarded safely', () => {
    sessionStorageMock.setItem(AUTH_SESSION_STORAGE_KEY, '{bad-json');

    const loaded = loadPersistedSession();

    expect(loaded.refreshToken).toBeNull();
    expect(sessionStorageMock.getItem(AUTH_SESSION_STORAGE_KEY)).toBeNull();
  });
});
