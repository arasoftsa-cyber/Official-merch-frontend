import { test, expect } from '@playwright/test';
import { loginAdmin, loginArtist } from '../helpers/auth';
import {
  createPendingMerchRequestViaArtistApi,
  extractOnboardingProductId,
  uploadMarketplaceImages,
} from '../helpers/onboarding';
import {
  artistRowByTitle,
  gotoArtistProducts,
  makeStamp,  
  openPendingMerchModalByTitle,
  pendingMerchReview,
  prepareOnboardingSuite,
} from '../helpers/onboarding-flow';

test.describe('Onboarding admin review', () => {
  test.setTimeout(120_000);

  test.beforeAll(async () => {
    await prepareOnboardingSuite();
  });

  test('admin can review a pending merch request, satisfy image gating, approve it, and unlock artist activation controls', async ({ page }) => {
    const merchName = makeStamp('pw-onb-approve');
    const merchStory = `Approval path story for ${merchName}.`;

    await loginArtist(page);
    await createPendingMerchRequestViaArtistApi(page, {
      merchName,
      merchStory,
      skuTypes: ['regular_tshirt', 'hoodie'],
    });

    await loginAdmin(page);
    await openPendingMerchModalByTitle(page, merchName);
    const review = pendingMerchReview(page);

    await expect(review.name).toContainText(merchName);
    await expect(review.story).toContainText(merchStory);
    await expect(review.designPreview).toBeVisible();
    await expect(review.skus).toContainText(/regular t-shirt/i);
    await expect(review.skus).toContainText(/hoodie/i);
    await expect(review.artist).not.toContainText(/^unknown artist$/i);

    await uploadMarketplaceImages(page, 3);
    await expect(review.approve).toBeDisabled();
    await expect(review.approveDisabledReason).toContainText(/at least 4/i);

    await uploadMarketplaceImages(page, 4);
    await expect(review.uploadList).toBeVisible();
    await expect(review.approve).toBeEnabled({ timeout: 10000 });

    const approveResponse = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        /\/api\/admin\/products\/[^/]+\/onboarding\/approve(?:[/?#]|$)/i.test(response.url()) &&
        response.ok(),
      { timeout: 30000 }
    );
    await review.approve.click();
    await approveResponse;
    await expect(review.name).toHaveCount(0);

    await loginArtist(page);
    await gotoArtistProducts(page);
    const row = artistRowByTitle(page, merchName);
    await expect(row).toBeVisible({ timeout: 20000 });
    await expect(row.getByTestId('artist-product-status')).toContainText(/inactive/i, {
      timeout: 20000,
    });

    const toggle = row.getByTestId('artist-merch-status-toggle');
    await expect(toggle).toBeVisible();
    await toggle.click();
    await expect(row.getByTestId('artist-product-status')).toContainText(/active/i, {
      timeout: 20000,
    });

    await toggle.click();
    await expect(row.getByTestId('artist-product-status')).toContainText(/inactive/i, {
      timeout: 20000,
    });
  });

  test('admin sees a readable error when pending merch detail hydration fails', async ({ page }) => {
    const merchName = makeStamp('pw-onb-detail-error');

    await loginArtist(page);
    const created = await createPendingMerchRequestViaArtistApi(page, {
      merchName,
      merchStory: `Detail failure story for ${merchName}.`,
      skuTypes: ['regular_tshirt'],
    });
    const productId = extractOnboardingProductId(created);
    expect(productId.length).toBeGreaterThan(0);

    await loginAdmin(page);
    await page.route(new RegExp(`/api/products/${productId}(?:[/?#]|$)`, 'i'), async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'detail_failed' }),
      });
    });

    await openPendingMerchModalByTitle(page, merchName);
    await expect(
      page.getByText(/detail_failed|failed to load pending merchandise details/i)
    ).toBeVisible({ timeout: 15000 });
  });
});
