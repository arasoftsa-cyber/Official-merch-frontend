import { test, expect } from '@playwright/test';
import { gotoApp, loginAdmin, loginArtist, loginBuyer } from '../helpers/auth';
import { DESIGN_IMAGE_PATH } from '../helpers/onboarding';
import {
  artistRowByTitle,
  gotoArtistProducts,
  makeStamp,
} from '../helpers/onboarding-flow';
import { prepareOnboardingSuite } from '../helpers/onboarding-flow';

test.describe('Onboarding artist submission', () => {
  test.setTimeout(120_000);

  test.beforeAll(async () => {
    await prepareOnboardingSuite();
  });

  test('artist sees New Merchandise button and non-artist views do not', async ({ page }) => {
    await loginArtist(page);
    await gotoArtistProducts(page);
    await expect(page.getByTestId('artist-new-merch-button')).toBeVisible({ timeout: 10000 });

    await loginAdmin(page);
    await gotoArtistProducts(page);
    await expect(page.getByTestId('artist-new-merch-button')).toHaveCount(0);

    await loginBuyer(page);
    await gotoApp(page, '/products', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('artist-new-merch-button')).toHaveCount(0);
  });

  test('artist form validation blocks invalid submission with inline errors', async ({ page }) => {
    await loginArtist(page);
    await gotoArtistProducts(page);
    await page.getByTestId('artist-new-merch-button').click();
    await expect(page.getByTestId('artist-new-merch-form')).toBeVisible({ timeout: 10000 });

    await page.getByTestId('artist-request-merch-submit').click();
    await expect(page.getByText(/merch name is required/i)).toBeVisible();
    await expect(page.getByText(/merch story is required/i)).toBeVisible();
    await expect(page.getByText(/design image is required/i)).toBeVisible();
    await expect(page.getByText(/select at least one sku type/i)).toBeVisible();

    await page.getByTestId('artist-merch-name').fill(makeStamp('validation-merch'));
    await page
      .getByTestId('artist-merch-story')
      .fill('Validation story with enough detail.');
    await page.getByTestId('artist-request-merch-submit').click();
    await expect(page.getByText(/design image is required/i)).toBeVisible();
    await expect(page.getByText(/select at least one sku type/i)).toBeVisible();

    await page.getByTestId('artist-merch-design-image').setInputFiles(DESIGN_IMAGE_PATH);
    await page.getByTestId('artist-request-merch-submit').click();
    await expect(page.getByText(/select at least one sku type/i)).toBeVisible();
  });

  test('artist can submit valid merch request and sees Pending status', async ({ page }) => {
    const merchName = makeStamp('pw-onb-success');
    const merchStory = `Story for ${merchName} with enough descriptive detail for validation.`;

    await loginArtist(page);
    await gotoArtistProducts(page);
    await page.getByTestId('artist-new-merch-button').click();
    await page.getByTestId('artist-merch-name').fill(merchName);
    await page.getByTestId('artist-merch-story').fill(merchStory);
    await page.getByTestId('artist-merch-design-image').setInputFiles(DESIGN_IMAGE_PATH);
    await page.getByTestId('artist-sku-regular-tshirt').check();
    await page.getByTestId('artist-sku-hoodie').check();
    await page.getByTestId('artist-request-merch-submit').click();

    await expect(page.getByTestId('artist-merch-submit-success')).toBeVisible({ timeout: 20000 });
    const row = artistRowByTitle(page, merchName);
    await expect(row).toBeVisible({ timeout: 20000 });
    await expect(row.getByTestId('artist-product-status')).toContainText(/pending/i, {
      timeout: 20000,
    });
  });
});


