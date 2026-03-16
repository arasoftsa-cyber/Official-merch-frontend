import { resolveApiBase } from '../src/config/apiBaseResolver';

const playwrightProfile = String(process.env.PLAYWRIGHT_PROFILE || 'local').trim().toLowerCase();
const isLocalProfile = playwrightProfile === 'local';
const localEnvSources = '.env.ui.local, .env, or CI env vars';
const productionEnvSources = '.env.production, .env, or CI env vars';
const activeEnvSources = isLocalProfile ? localEnvSources : productionEnvSources;

type CredentialedRole = 'buyer' | 'admin' | 'artist' | 'label';

const credentialEnvKeys = {
  buyer: ['BUYER_EMAIL', 'BUYER_PASSWORD'],
  admin: ['ADMIN_EMAIL', 'ADMIN_PASSWORD'],
  artist: ['ARTIST_EMAIL', 'ARTIST_PASSWORD'],
  label: ['LABEL_EMAIL', 'LABEL_PASSWORD'],
} as const;

const readEnv = (key: string) => String(process.env[key] || '').trim();

const requireEnvGroup = <TKeys extends readonly string[]>(
  keys: TKeys,
  laneLabel: string
): Record<TKeys[number], string> => {
  const missing = keys.filter((key) => !readEnv(key));
  if (missing.length > 0) {
    throw new Error(
      `[${laneLabel}] Missing ${missing.join(', ')}. Set them in ${activeEnvSources}.`
    );
  }

  const values = {} as Record<TKeys[number], string>;
  for (const key of keys) {
    values[key] = readEnv(key);
  }
  return values;
};

let browserAppEnvCache:
  | { UI_BASE_URL: string; API_BASE_URL: string; VITE_API_BASE_URL: string }
  | null = null;

export function requireEnv(key: string, laneLabel = 'playwright:browser'): string {
  return requireEnvGroup([key] as const, laneLabel)[key];
}

export function getBrowserAppEnv() {
  if (browserAppEnvCache) {
    return browserAppEnvCache;
  }

  const { UI_BASE_URL } = requireEnvGroup(['UI_BASE_URL'] as const, 'playwright:browser');
  const apiResolutionMode = isLocalProfile ? 'development' : 'production';
  const uiHostname = (() => {
    try {
      return new URL(UI_BASE_URL).hostname;
    } catch {
      return '';
    }
  })();
  const uiOrigin = (() => {
    try {
      return new URL(UI_BASE_URL).origin;
    } catch {
      return '';
    }
  })();
  const API_BASE_URL = resolveApiBase({
    mode: apiResolutionMode,
    isDev: isLocalProfile,
    isProd: !isLocalProfile,
    hostname: uiHostname,
    origin: uiOrigin,
    apiBaseUrl: process.env.VITE_API_BASE_URL,
  });

  browserAppEnvCache = {
    UI_BASE_URL,
    API_BASE_URL,
    VITE_API_BASE_URL: API_BASE_URL,
  };
  return browserAppEnvCache;
}

export function hasCredentialedAccountEnv(role: CredentialedRole): boolean {
  return credentialEnvKeys[role].every((key) => Boolean(readEnv(key)));
}

export function getCredentialedAccount(role: CredentialedRole) {
  const [emailKey, passwordKey] = credentialEnvKeys[role];
  const values = requireEnvGroup(credentialEnvKeys[role], `playwright:credentialed:${role}`);
  return {
    email: values[emailKey],
    password: values[passwordKey],
  };
}

export const UI_BASE_URL = getBrowserAppEnv().UI_BASE_URL;
export const API_BASE_URL = getBrowserAppEnv().API_BASE_URL;
export const VITE_API_BASE_URL = API_BASE_URL;
