import { expect, type Page } from '@playwright/test';

export const PRODUCT_CARD_SELECTORS = [
  '[data-testid="product-catalog-card"]',
];

export const getProductCards = (page: Page) => page.locator(PRODUCT_CARD_SELECTORS.join(', '));

export const cartLinkInHeader = (page: Page) => page.locator('header a[href="/cart"]');
export const myAccountLinkInHeader = (page: Page) => page.locator('header a[href="/fan"]');

export const partnerLogoutButton = (page: Page) =>
  page.getByRole('button', { name: /logout/i }).first();

export const expectRedirectToPortalLogin = async (
  page: Page,
  expectedReturnTo?: string
) => {
  await expect(page).toHaveURL(/\/(fan|partner)\/login/, { timeout: 15000 });
  if (!expectedReturnTo) return;
  const redirectedUrl = new URL(page.url());
  if (!/^\/(fan|partner)\/login$/i.test(redirectedUrl.pathname)) return;
  expect(
    redirectedUrl.searchParams.get('returnTo') ||
      redirectedUrl.searchParams.get('returnUrl')
  ).toBe(expectedReturnTo);
};
