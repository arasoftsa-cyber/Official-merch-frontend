import { expect, test } from '@playwright/test';
import { resolveApiBase } from '../../src/config/apiBaseResolver';

const EXPLICIT_API = 'https://api.officialmerch.tech';
const SAME_ORIGIN = 'https://officialmerch.tech';
const DEV_API = 'http://localhost:3000';
const NON_LOCAL_HOST = 'officialmerch.tech';

test.describe('API base resolution', () => {
  test('prefers explicit VITE_API_BASE_URL when provided', () => {
    const resolved = resolveApiBase({
      mode: 'production',
      isProd: true,
      apiBaseUrl: EXPLICIT_API,
      origin: SAME_ORIGIN,
      hostname: NON_LOCAL_HOST,
    });
    expect(resolved).toBe(EXPLICIT_API);
  });

  test('uses same-origin fallback on deployed hosts when explicit API base is unset', () => {
    const resolved = resolveApiBase({
      mode: 'development',
      origin: SAME_ORIGIN,
      hostname: NON_LOCAL_HOST,
    });
    expect(resolved).toBe(SAME_ORIGIN);
  });

  test('keeps local dev behavior on localhost without explicit env', () => {
    const resolved = resolveApiBase({
      mode: 'development',
      isDev: true,
      hostname: 'localhost',
    });
    expect(resolved).toBe(DEV_API);
  });

  test('accepts an explicit localhost API base during development', () => {
    const resolved = resolveApiBase({
      mode: 'development',
      isDev: true,
      apiBaseUrl: DEV_API,
      hostname: 'localhost',
    });
    expect(resolved).toBe(DEV_API);
  });

  test('throws when production/non-local resolution would use localhost API base', () => {
    expect(() =>
      resolveApiBase({
        mode: 'production',
        isProd: true,
        apiBaseUrl: 'http://localhost:3000',
        hostname: NON_LOCAL_HOST,
      })
    ).toThrow('must not point to localhost');
  });

  test('normalizes trailing slash from VITE_API_BASE_URL', () => {
    const resolved = resolveApiBase({
      mode: 'production',
      isProd: true,
      apiBaseUrl: 'https://api.officialmerch.tech/',
      hostname: NON_LOCAL_HOST,
    });
    expect(resolved).toBe('https://api.officialmerch.tech');
  });

  test('throws when all API base env values are empty', () => {
    expect(() =>
      resolveApiBase({
        mode: 'production',
        isProd: true,
        apiBaseUrl: '',
        origin: '',
        hostname: NON_LOCAL_HOST,
      })
    ).toThrow('Missing API base URL');
  });

  test('throws for malformed API base values', () => {
    expect(() =>
      resolveApiBase({
        mode: 'production',
        isProd: true,
        apiBaseUrl: 'not-a-url',
        hostname: NON_LOCAL_HOST,
      })
    ).toThrow('valid absolute http(s) URL');
  });
});
