import { defineConfig } from '@playwright/test';

const configuredWorkers = Number(process.env.PW_WORKERS || '');
const resolvedWorkers =
  Number.isFinite(configuredWorkers) && configuredWorkers > 0 ? configuredWorkers : 1;

export default defineConfig({
  testDir: './tests',
  testMatch: ['config/**/*.spec.ts'],
  timeout: 30_000,
  workers: resolvedWorkers,
  retries: 0,
  use: {
    headless: true,
  },
});
