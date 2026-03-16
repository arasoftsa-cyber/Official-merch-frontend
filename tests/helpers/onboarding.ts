import fs from 'node:fs';
import path from 'node:path';
import type { Page } from '@playwright/test';

const FIXTURES_DIR = path.resolve(__dirname, '..', 'fixtures');

export const DESIGN_IMAGE_PATH = path.join(FIXTURES_DIR, 'listing-photo-1.png');
export const MARKETPLACE_IMAGE_PATHS = [
  path.join(FIXTURES_DIR, 'listing-photo-1.png'),
  path.join(FIXTURES_DIR, 'listing-photo-2.png'),
  path.join(FIXTURES_DIR, 'listing-photo-3.png'),
  path.join(FIXTURES_DIR, 'listing-photo-4.png'),
];

const ensureFixture = (filePath: string) => {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing onboarding test fixture: ${filePath}`);
  }
};

export const ensureOnboardingFixtures = () => {
  ensureFixture(DESIGN_IMAGE_PATH);
  for (const imagePath of MARKETPLACE_IMAGE_PATHS) {
    ensureFixture(imagePath);
  }
};

export const uploadMarketplaceImages = async (page: Page, count: number) => {
  ensureOnboardingFixtures();
  await page.getByTestId('admin-marketplace-images-input').setInputFiles(
    MARKETPLACE_IMAGE_PATHS.slice(0, count)
  );
};
