import * as dotenv from 'dotenv';
import { defineConfig, devices } from '@playwright/test';

dotenv.config({ path: '.env.ui.local' });
dotenv.config();

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  workers: 3,
  retries: 0,
  use: {
    baseURL: process.env.UI_BASE_URL || 'http://localhost:5173',
    headless: false,
  },
  // Multi-browser projects intentionally disabled for local dev simplicity
});
