import { expect, test } from '@playwright/test';
import { resolveApiBase } from '../../src/config/apiBaseResolver';

const EXPLICIT_API = 'https://api.officialmerch.tech';
const DEV_API = 'http://localhost:3000';
const NON_LOCAL_HOST = 'officialmerch.tech';
const PROD_API = '/api';

test.describe('API base resolution', () => {
  test('prefers explicit VITE_API_BASE_URL when provided', () => {
    const resolved = resolveApiBase({
      mode: 'production',
      isProd: true,
      apiBaseUrl: EXPLICIT_API,
      hostname: NON_LOCAL_HOST,
    });
    expect(resolved).toBe(EXPLICIT_API);
  });

  test('uses /api in production when explicit API base is unset', () => {
    const resolved = resolveApiBase({
      mode: 'production',
      isProd: true,
      origin: 'https://officialmerch.tech',
      hostname: NON_LOCAL_HOST,
    });
    expect(resolved).toBe(PROD_API);
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

  test('does not reject localhost browser origin during development', () => {
    const resolved = resolveApiBase({
      mode: 'development',
      isDev: true,
      origin: 'http://localhost:5173',
      hostname: 'localhost',
    });
    expect(resolved).toBe(DEV_API);
  });

  test('keeps localhost behavior in test mode', () => {
    const resolved = resolveApiBase({
      mode: 'test',
      isTest: true,
      origin: 'http://localhost:5173',
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

  test('uses /api when production env values are empty', () => {
    expect(() =>
      resolveApiBase({
        mode: 'production',
        isProd: true,
        apiBaseUrl: '',
        origin: '',
      })
    ).not.toThrow();
    expect(
      resolveApiBase({
        mode: 'production',
        isProd: true,
        apiBaseUrl: '',
        origin: '',
      })
    ).toBe(PROD_API);
  });

  test('throws when mode cannot be resolved and explicit API base is absent', () => {
    expect(() =>
      resolveApiBase({
        mode: '',
        apiBaseUrl: '',
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
