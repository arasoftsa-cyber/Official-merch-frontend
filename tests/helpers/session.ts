import { expect, test as base, type Page } from '@playwright/test';
import { loginAdmin, loginArtist, loginBuyer, loginLabel } from './auth';

type RoleSessionFixtures = {
  adminPage: Page;
  artistPage: Page;
  buyerPage: Page;
  labelPage: Page;
};

export const test = base.extend<RoleSessionFixtures>({
  adminPage: async ({ page }, use) => {
    await loginAdmin(page);
    await use(page);
  },
  artistPage: async ({ page }, use) => {
    await loginArtist(page);
    await use(page);
  },
  buyerPage: async ({ page }, use) => {
    await loginBuyer(page);
    await use(page);
  },
  labelPage: async ({ page }, use) => {
    await loginLabel(page);
    await use(page);
  },
});

export { expect };
