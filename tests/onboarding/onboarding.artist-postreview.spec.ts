import { test, expect } from '../helpers/session';
import { createPendingMerchRequestViaArtistApi } from '../helpers/onboarding';
import {
  artistRowByTitle,
  gotoArtistProducts,
  makeStamp,
  prepareOnboardingSuite,
} from '../helpers/onboarding-flow';

test.describe('Onboarding artist post-review state', () => {
  test.beforeAll(async () => {
    await prepareOnboardingSuite();
  });

  test('artist sees submitted merch fields as read-only after submission', async ({ artistPage }) => {
    const merchName = makeStamp('pw-onb-readonly');

    await createPendingMerchRequestViaArtistApi(artistPage, {
      merchName,
      merchStory: `Read-only enforcement story for ${merchName}.`,
      skuTypes: ['oversized_hoodie'],
    });

    await gotoArtistProducts(artistPage);
    const row = artistRowByTitle(artistPage, merchName);
    await expect(row).toBeVisible({ timeout: 20000 });
    await expect(row.getByTestId('artist-product-status')).toContainText(/pending/i);
    await expect(row.getByTestId('artist-merch-readonly-name')).toContainText(merchName);
    await expect(row.getByTestId('artist-merch-readonly-story')).toBeVisible();
    await expect(row.getByTestId('artist-merch-readonly-design-image')).toContainText(/uploaded/i);
    await expect(row.getByTestId('artist-merch-readonly-skus')).toContainText(/oversized hoodie/i);
    await expect(row.getByTestId('artist-merch-status-toggle')).toHaveCount(0);
    await expect(row.locator('input, textarea, select')).toHaveCount(0);
  });
});


