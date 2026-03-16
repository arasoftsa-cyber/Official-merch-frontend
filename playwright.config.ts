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
const isStaticProfile = profile === 'static';
const isLocalProfile = profile === 'local';
const isConfigContractsProfile = profile === 'prod-config' || profile === 'production';
const isLiveProfile = profile === 'live' || profile === 'credentialed';

if (!isStaticProfile && !isLocalProfile && !isConfigContractsProfile && !isLiveProfile) {
  throw new Error(
    `[playwright] Unsupported PLAYWRIGHT_PROFILE="${profile}". Use "static", "local", "prod-config", "production", "live", or "credentialed".`
  );
}

const envFiles = isStaticProfile
  ? []
  : isLocalProfile
    ? [envUiLocalPath, envPath]
    : [envProductionPath, envPath];
const loadedEnvPaths = envFiles.filter((envFile) => fs.existsSync(envFile));

if (!isStaticProfile && loadedEnvPaths.length === 0 && !isCi) {
  const expectedPaths = envFiles.join(', ');
  throw new Error(`Playwright env file not found. Checked: ${expectedPaths}`);
}

if (!isStaticProfile) {
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
}

let UI_BASE_URL: string | undefined;
let API_BASE_URL: string | undefined;

if (isLocalProfile || isLiveProfile) {
  // Resolve browser env only for browser-backed lanes. Static config contracts
  // intentionally avoid any URL or credential requirements.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const testEnv = require('./tests/_env');
  const browserEnv = testEnv.getBrowserAppEnv();
  UI_BASE_URL = browserEnv.UI_BASE_URL;
  API_BASE_URL = browserEnv.API_BASE_URL;

  if (isLocalProfile) {
    assertLocalUrl('UI_BASE_URL', UI_BASE_URL);
    assertLocalUrl('API_BASE_URL', API_BASE_URL);
  }

  console.log(`[playwright] profile=${profile} baseURL=${UI_BASE_URL} apiBaseURL=${API_BASE_URL}`);
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

const configContractsProject = {
  name: 'config-contracts',
  testMatch: ['tests/config/**/*.spec.ts'],
  timeout: 30_000,
  workers: 1,
  use: {
    headless: true,
  },
};

const localProjects = [
  {
    name: 'local-integration',
    testIgnore: [
      'tests/config/**/*.spec.ts',
      'tests/contract-smoke/**/*.spec.ts',
      'tests/smoke/**/*.spec.ts',
    ],
  },
  {
    name: 'local-smoke',
    testMatch: ['tests/smoke/**/*.spec.ts'],
    workers: 1,
  },
  {
    ...configContractsProject,
  },
];

const liveProjects = [
  {
    name: 'credentialed-contract-smoke',
    testMatch: ['tests/contract-smoke/**/*.spec.ts'],
    grep: /@credentialed/i,
    timeout: 120_000,
    workers: 1,
    use: {
      headless: true,
    },
  },
];

export default defineConfig({
  testDir: './tests',
  globalSetup: isStaticProfile ? undefined : require.resolve('./tests/global-setup'),
  timeout: 60_000,
  workers: resolvedWorkers,
  retries: 0,
  // Static/config contract runs are env-independent. Browser integration lanes are
  // explicit so credentialed tests are never the default CI gate.
  projects: isStaticProfile || isConfigContractsProfile
    ? [configContractsProject]
    : isLocalProfile
      ? localProjects
      : liveProjects,
  use: defaultUse,
  // Multi-browser projects intentionally disabled for local dev simplicity
});
