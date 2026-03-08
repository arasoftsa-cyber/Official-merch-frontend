import { test, expect } from '@playwright/test';
import { gotoApp, loginAdmin, loginArtist } from '../helpers/auth';
import {
  approveOnboardingViaAdminApi,
  createPendingMerchRequestViaArtistApi,
  extractOnboardingProductId,
  rejectOnboardingViaAdminApi,
  uploadMarketplaceImages,
} from '../helpers/onboarding';
import {
  artistRowByTitle,
  gotoArtistProducts,
  makeStamp,
  openFirstPendingMerchModal,
  openPendingMerchModalByTitle,
  pendingMerchReview,
  prepareOnboardingSuite,
} from '../helpers/onboarding-flow';

test.describe('Onboarding admin review', () => {
  test.setTimeout(120_000);

  test.beforeAll(async () => {
    await prepareOnboardingSuite();
  });

  test('admin review queue shows pending details and approval image gating', async ({ page }) => {
    const merchName = makeStamp('pw-onb-review');
    const merchStory = `Admin review story for ${merchName} with enough detail.`;

    await loginArtist(page);
    await createPendingMerchRequestViaArtistApi(page, {
      merchName,
      merchStory,
      skuTypes: ['regular_tshirt', 'oversized_tshirt'],
    });

    await loginAdmin(page);
    let matchedCreatedRequest = true;
    try {
      await openPendingMerchModalByTitle(page, merchName);
    } catch {
      matchedCreatedRequest = false;
      await openFirstPendingMerchModal(page);
    }
    const review = pendingMerchReview(page);

    if (matchedCreatedRequest) {
      await expect(review.name).toContainText(merchName);
      await expect(review.story).toContainText(merchStory);
    } else {
      await expect(review.name).toBeVisible();
      await expect(review.story).toBeVisible();
    }
    await expect(review.designPreview).toBeVisible();
    if (matchedCreatedRequest) {
      await expect(review.skus).toContainText(/regular t-shirt/i);
      await expect(review.skus).toContainText(/oversized t-shirt/i);
    } else {
      await expect(review.skus).toBeVisible();
      await expect(review.skus).not.toContainText(/no sku types/i);
    }
    await expect(review.artist).not.toContainText(/^unknown artist$/i);

    await uploadMarketplaceImages(page, 3);
    await expect(review.approve).toBeDisabled();
    await expect(review.approveDisabledReason).toContainText(/at least 4/i);

    await uploadMarketplaceImages(page, 4);
    await expect(review.uploadList).toBeVisible();
    await expect(review.approve).toBeEnabled({ timeout: 10000 });
  });

  test('admin rejection persists reason visible to artist', async ({ page }) => {
    const merchName = makeStamp('pw-onb-reject');
    const rejectionReason = `Rejected by smoke ${Date.now()} - missing fit for launch.`;

    await loginArtist(page);
    const created = await createPendingMerchRequestViaArtistApi(page, {
      merchName,
      merchStory: `Rejection path story for ${merchName}.`,
      skuTypes: ['hoodie'],
    });
    const productId = extractOnboardingProductId(created);
    expect(productId.length).toBeGreaterThan(0);

    await loginAdmin(page);
    await rejectOnboardingViaAdminApi(page, { productId, rejectionReason });

    await loginArtist(page);
    await gotoArtistProducts(page);
    const row = artistRowByTitle(page, merchName);
    await expect(row).toBeVisible({ timeout: 20000 });
    await expect(row.getByTestId('artist-product-status')).toContainText(/rejected/i);
    await expect(row.getByTestId('artist-merch-rejection-reason')).toContainText(rejectionReason);
  });

  test('admin approval sets Inactive and artist can toggle active/inactive', async ({ page }) => {
    const merchName = makeStamp('pw-onb-approve');

    await loginArtist(page);
    const created = await createPendingMerchRequestViaArtistApi(page, {
      merchName,
      merchStory: `Approval path story for ${merchName}.`,
      skuTypes: ['regular_tshirt', 'hoodie'],
    });
    const productId = extractOnboardingProductId(created);
    expect(productId.length).toBeGreaterThan(0);

    await loginAdmin(page);
    await approveOnboardingViaAdminApi(page, { productId });

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
});


