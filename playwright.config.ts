import { defineConfig } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

const assertLocalUrl = (label: string, value: string) => {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`[playwright:local] ${label} must be a valid URL, got "${value}"`);
  }

  if (!LOCAL_HOSTS.has(parsed.hostname.toLowerCase())) {
    throw new Error(
      `[playwright:local] ${label} must target localhost/127.0.0.1/::1, got "${value}"`
    );
  }
};

const repoRoot = __dirname;
const envUiLocalPath = path.resolve(repoRoot, '.env.ui.local');
const envPath = path.resolve(repoRoot, '.env');
const hasEnvUiLocal = fs.existsSync(envUiLocalPath);
const hasEnv = fs.existsSync(envPath);
const isCi = Boolean(process.env.CI);
const profile = String(process.env.PLAYWRIGHT_PROFILE || 'local')
  .trim()
  .toLowerCase();

if (!hasEnvUiLocal && !hasEnv && !isCi) {
  throw new Error(
    `Playwright env file not found: ${envUiLocalPath}. Checked fallback: ${envPath}`
  );
}

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const dotenv = require('dotenv');
  if (hasEnvUiLocal) dotenv.config({ path: envUiLocalPath });
  if (hasEnv) dotenv.config({ path: envPath, override: false });
} catch (error: any) {
  throw new Error(
    `Failed to load dotenv for Playwright config. envUiLocalPath=${envUiLocalPath} envPath=${envPath} message=${error?.message ?? 'unknown'}`
  );
}

// Load required test env exports only after dotenv has populated process.env.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { UI_BASE_URL, VITE_API_BASE_URL } = require('./tests/_env');

if (profile !== 'local') {
  throw new Error(
    `[playwright] Unsupported PLAYWRIGHT_PROFILE="${profile}" for playwright.config.ts. Use "local".`
  );
}
assertLocalUrl('UI_BASE_URL', UI_BASE_URL);
assertLocalUrl('VITE_API_BASE_URL', VITE_API_BASE_URL);

console.log(`[playwright] baseURL=${UI_BASE_URL} apiBaseURL=${VITE_API_BASE_URL}`);

const configuredWorkers = Number(process.env.PW_WORKERS || '');
const resolvedWorkers =
  Number.isFinite(configuredWorkers) && configuredWorkers > 0
    ? configuredWorkers
    : isCi
      ? 1
      : 2;

export default defineConfig({
  testDir: './tests',
  globalSetup: require.resolve('./tests/global-setup'),
  timeout: 60_000,
  workers: resolvedWorkers,
  retries: 0,
  use: {
    baseURL: UI_BASE_URL,
    headless: isCi ? true : false,
  },
  // Multi-browser projects intentionally disabled for local dev simplicity
});
