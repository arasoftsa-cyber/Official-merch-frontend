import { expect, test } from '@playwright/test';
import { resolveApiBase } from '../../src/config/apiBaseResolver';

const PROD_API = process.env.VITE_API_BASE_PROD?.trim() || 'https://api.officialmerch.tech';
const DEV_API = process.env.VITE_API_BASE_DEV?.trim() || 'http://localhost:3000';
const LEGACY_API = process.env.VITE_API_BASE_URL?.trim() || 'http://76.13.241.73:3000';
const NON_LOCAL_HOST = process.env.PROD_CONFIG_HOSTNAME?.trim() || 'officialmerch.tech';

test.describe('API base resolution', () => {
  test('prefers production API env in production mode', () => {
    const resolved = resolveApiBase({
      mode: 'production',
      apiBaseProd: PROD_API,
      apiBaseDev: DEV_API,
      apiBaseLegacy: LEGACY_API,
      hostname: NON_LOCAL_HOST,
    });
    expect(resolved).toBe(PROD_API);
  });

  test('uses production API env on non-local host even when mode is development', () => {
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
});
