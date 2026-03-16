import { test, expect } from '@playwright/test';
import { loginArtist } from '../helpers/auth';
import {
  expectArtistMerchReadonlyRow,
  gotoArtistProducts,
  makeStamp,
  submitArtistMerchRequestViaUi,
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
    await submitArtistMerchRequestViaUi(page, {
      merchName,
      merchStory,
      skuTestIds: ['artist-sku-regular-tshirt', 'artist-sku-hoodie'],
    });
    const row = await expectArtistMerchReadonlyRow(page, {
      merchName,
      skuLabelPattern: /regular t-shirt|hoodie/i,
    });
    await expect(row.getByTestId('artist-product-status')).toContainText(/pending/i, { timeout: 20000 });
    await expect(row.getByTestId('artist-merch-status-toggle')).toHaveCount(0);
  });
});
