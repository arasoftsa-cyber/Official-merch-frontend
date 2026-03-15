import { test, expect } from '@playwright/test';
import { loginArtist } from '../helpers/auth';
import { DESIGN_IMAGE_PATH } from '../helpers/onboarding';
import {
  expectArtistMerchReadonlyRow,
  gotoArtistProducts,
  makeStamp,
  submitArtistMerchRequest,
} from '../helpers/onboarding-flow';
import { prepareOnboardingSuite } from '../helpers/onboarding-flow';

test.describe('Onboarding artist submission', () => {
  test.setTimeout(120_000);

  test.beforeAll(async () => {
    await prepareOnboardingSuite();
  });

  test('artist can submit merch, see pending status, and view the request in read-only form', async ({ page }) => {
    const merchName = makeStamp('pw-onb-success');
    const merchStory = `Story for ${merchName} with enough descriptive detail for validation.`;

    await loginArtist(page);
    await gotoArtistProducts(page);
    await submitArtistMerchRequest(page, {
      merchName,
      merchStory,
      skuTestIds: ['artist-sku-regular-tshirt', 'artist-sku-hoodie'],
    });
    await page.getByTestId('artist-merch-design-image').setInputFiles(DESIGN_IMAGE_PATH);
    await page.getByTestId('artist-request-merch-submit').click();

    await expect(page.getByTestId('artist-merch-submit-success')).toBeVisible({ timeout: 20000 });
    const row = await expectArtistMerchReadonlyRow(page, {
      merchName,
      skuLabelPattern: /regular t-shirt|hoodie/i,
    });
    await expect(row.getByTestId('artist-product-status')).toContainText(/pending/i, { timeout: 20000 });
    await expect(row.getByTestId('artist-merch-status-toggle')).toHaveCount(0);
  });
});
