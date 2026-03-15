import { resolveApiBase } from '../src/config/apiBaseResolver';

export function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value || !value.trim()) {
    throw new Error(`Missing ${key} in Playwright env (.env.ui.local, .env, or CI env vars)`);
  }
  return value.trim();
}

export const UI_BASE_URL = requireEnv('UI_BASE_URL');
const playwrightProfile = String(process.env.PLAYWRIGHT_PROFILE || '').trim().toLowerCase();
const apiResolutionMode =
  playwrightProfile === 'local' ? 'development' : process.env.NODE_ENV || 'test';
const uiHostname = (() => {
  try {
    return new URL(UI_BASE_URL).hostname;
  } catch {
    return '';
  }
})();

export const API_BASE_URL = resolveApiBase({
  mode: apiResolutionMode,
  hostname: uiHostname,
  backendBaseUrl: process.env.VITE_BACKEND_BASE_URL,
  apiBaseProd: process.env.VITE_API_BASE_PROD,
  apiBaseProdCompat: process.env.VITE_PROD_API_BASE_URL,
  apiBaseDev: process.env.VITE_API_BASE_DEV,
  apiBaseLegacy: process.env.VITE_API_BASE_URL,
});

// Backward-compatible export name used by existing helpers/specs.
export const VITE_API_BASE_URL = API_BASE_URL;
export const BUYER_EMAIL = requireEnv('BUYER_EMAIL');
export const BUYER_PASSWORD = requireEnv('BUYER_PASSWORD');
export const ADMIN_EMAIL = requireEnv('ADMIN_EMAIL');
export const ADMIN_PASSWORD = requireEnv('ADMIN_PASSWORD');
export const ARTIST_EMAIL = requireEnv('ARTIST_EMAIL');
export const ARTIST_PASSWORD = requireEnv('ARTIST_PASSWORD');
export const LABEL_EMAIL = requireEnv('LABEL_EMAIL');
export const LABEL_PASSWORD = requireEnv('LABEL_PASSWORD');
