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
const envProductionPath = path.resolve(repoRoot, '.env.production');
const envPath = path.resolve(repoRoot, '.env');
const isCi = Boolean(process.env.CI);
const profile = String(process.env.PLAYWRIGHT_PROFILE || 'local')
  .trim()
  .toLowerCase();
const isLocalProfile = profile === 'local';
const isConfigContractsProfile = profile === 'prod-config' || profile === 'production';

if (!isLocalProfile && !isConfigContractsProfile) {
  throw new Error(
    `[playwright] Unsupported PLAYWRIGHT_PROFILE="${profile}". Use "local", "prod-config", or "production".`
  );
}

const envFiles = isLocalProfile
  ? [envUiLocalPath, envPath]
  : [envProductionPath, envPath];
const loadedEnvPaths = envFiles.filter((envFile) => fs.existsSync(envFile));

if (loadedEnvPaths.length === 0 && !isCi) {
  const expectedPaths = envFiles.join(', ');
  throw new Error(`Playwright env file not found. Checked: ${expectedPaths}`);
}

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const dotenv = require('dotenv');
  for (const envFile of loadedEnvPaths) {
    dotenv.config({ path: envFile, override: false });
  }
} catch (error: any) {
  throw new Error(
    `Failed to load dotenv for Playwright config. envFiles=${loadedEnvPaths.join(', ')} message=${error?.message ?? 'unknown'}`
  );
}

let UI_BASE_URL: string | undefined;
let API_BASE_URL: string | undefined;

if (isLocalProfile) {
  // Load required test env exports only after dotenv has populated process.env.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const localEnv = require('./tests/_env');
  UI_BASE_URL = localEnv.UI_BASE_URL;
  API_BASE_URL = localEnv.API_BASE_URL;
  assertLocalUrl('UI_BASE_URL', UI_BASE_URL);
  assertLocalUrl('API_BASE_URL', API_BASE_URL);
  console.log(`[playwright] baseURL=${UI_BASE_URL} apiBaseURL=${API_BASE_URL}`);
} else {
  console.log(`[playwright] profile=${profile} project=config-contracts`);
}

const configuredWorkers = Number(process.env.PW_WORKERS || '');
const resolvedWorkers =
  Number.isFinite(configuredWorkers) && configuredWorkers > 0
    ? configuredWorkers
    : isCi
      ? 1
      : 2;

const defaultUse = {
  baseURL: UI_BASE_URL,
  headless: isCi ? true : !isLocalProfile,
};

const localProjects = [
  {
    name: 'default',
    testIgnore: ['tests/config/**/*.spec.ts', 'tests/contract-smoke/**/*.spec.ts', 'tests/smoke/**/*.spec.ts'],
  },
  {
    name: 'smoke',
    testMatch: ['tests/smoke/**/*.spec.ts'],
    workers: 1,
  },
  {
    name: 'contract-smoke',
    testMatch: ['tests/contract-smoke/**/*.spec.ts'],
    workers: 1,
  },
  {
    name: 'config-contracts',
    testMatch: ['tests/config/**/*.spec.ts'],
    timeout: 30_000,
    workers: 1,
    use: {
      headless: true,
    },
  },
];

export default defineConfig({
  testDir: './tests',
  globalSetup: require.resolve('./tests/global-setup'),
  timeout: 60_000,
  workers: resolvedWorkers,
  retries: 0,
  projects: isLocalProfile ? localProjects : localProjects.filter((project) => project.name === 'config-contracts'),
  use: defaultUse,
  // Multi-browser projects intentionally disabled for local dev simplicity
});
