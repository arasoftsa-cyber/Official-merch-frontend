import { expect, test } from '@playwright/test';
import { resolveApiBase } from '../../src/config/apiBaseResolver';

const CANONICAL_API = 'https://canonical-api.officialmerch.tech';
const PROD_API = 'https://prod-api.officialmerch.tech';
const DEV_API = 'http://localhost:3000';
const LEGACY_API = 'https://legacy-api.officialmerch.tech';
const NON_LOCAL_HOST = 'officialmerch.tech';

test.describe('API base resolution', () => {
  test('prefers canonical backend base env key when provided', () => {
    const resolved = resolveApiBase({
      mode: 'production',
      backendBaseUrl: CANONICAL_API,
      apiBaseProd: PROD_API,
      apiBaseDev: DEV_API,
      apiBaseLegacy: LEGACY_API,
      hostname: NON_LOCAL_HOST,
    });
    expect(resolved).toBe(CANONICAL_API);
  });

  test('uses production-safe API env on non-local host even when mode is development', () => {
    const resolved = resolveApiBase({
      mode: 'development',
      apiBaseProd: PROD_API,
      apiBaseDev: LEGACY_API,
      hostname: NON_LOCAL_HOST,
    });
    expect(resolved).toBe(PROD_API);
  });

  test('keeps local dev behavior on localhost', () => {
    const resolved = resolveApiBase({
      mode: 'development',
      apiBaseProd: PROD_API,
      apiBaseDev: DEV_API,
      hostname: 'localhost',
    });
    expect(resolved).toBe(DEV_API);
  });

  test('allows localhost API base in test context', () => {
    const resolved = resolveApiBase({
      mode: 'test',
      backendBaseUrl: DEV_API,
      apiBaseProd: PROD_API,
      hostname: 'localhost',
    });
    expect(resolved).toBe(DEV_API);
  });

  test('accepts production compatibility env key when VITE_API_BASE_PROD is unset', () => {
    const resolved = resolveApiBase({
      mode: 'production',
      apiBaseProdCompat: PROD_API,
      apiBaseDev: DEV_API,
      apiBaseLegacy: LEGACY_API,
      hostname: NON_LOCAL_HOST,
    });
    expect(resolved).toBe(PROD_API);
  });

  test('throws when production/non-local resolution would use localhost API base', () => {
    expect(() =>
      resolveApiBase({
        mode: 'production',
        apiBaseProd: 'http://localhost:3000',
        hostname: NON_LOCAL_HOST,
      })
    ).toThrow('must not point to localhost');
  });

  test('normalizes trailing slash from canonical backend key', () => {
    const resolved = resolveApiBase({
      mode: 'production',
      backendBaseUrl: 'https://api.officialmerch.tech/',
      hostname: NON_LOCAL_HOST,
    });
    expect(resolved).toBe('https://api.officialmerch.tech');
  });

  test('throws when all API base env values are empty', () => {
    expect(() =>
      resolveApiBase({
        mode: 'development',
        backendBaseUrl: '   ',
        apiBaseProd: '',
        apiBaseProdCompat: '',
        apiBaseDev: '',
        apiBaseLegacy: '',
        hostname: 'localhost',
      })
    ).toThrow('Missing API base URL');
  });

  test('throws for malformed API base values', () => {
    expect(() =>
      resolveApiBase({
        mode: 'production',
        backendBaseUrl: 'not-a-url',
        hostname: NON_LOCAL_HOST,
      })
    ).toThrow('valid absolute http(s) URL');
  });
});
