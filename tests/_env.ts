export function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value || !value.trim()) {
    throw new Error(`Missing ${key} in Playwright env (.env.ui.local, .env, or CI env vars)`);
  }
  return value.trim();
}

export const UI_BASE_URL = requireEnv('UI_BASE_URL');
export const VITE_API_BASE_URL =
  process.env.VITE_API_BASE_URL?.trim() ||
  process.env.VITE_API_BASE_DEV?.trim() ||
  process.env.VITE_API_BASE_PROD?.trim() ||
  requireEnv('VITE_API_BASE_URL');
export const BUYER_EMAIL = requireEnv('BUYER_EMAIL');
export const BUYER_PASSWORD = requireEnv('BUYER_PASSWORD');
export const ADMIN_EMAIL = requireEnv('ADMIN_EMAIL');
export const ADMIN_PASSWORD = requireEnv('ADMIN_PASSWORD');
export const ARTIST_EMAIL = requireEnv('ARTIST_EMAIL');
export const ARTIST_PASSWORD = requireEnv('ARTIST_PASSWORD');
export const LABEL_EMAIL = requireEnv('LABEL_EMAIL');
export const LABEL_PASSWORD = requireEnv('LABEL_PASSWORD');
