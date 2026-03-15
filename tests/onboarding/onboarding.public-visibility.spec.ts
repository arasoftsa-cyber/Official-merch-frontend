import { test, expect } from '@playwright/test';
import { gotoApp, loginAdmin, loginArtist, loginBuyer } from '../helpers/auth';
import {
  createAdminProductWithStatus,
  ensureArtistIdentityForAdmin,
  makeStamp,
  gotoArtistProducts,
} from '../helpers/onboarding-flow';
import { prepareOnboardingSuite } from '../helpers/onboarding-flow';
import {
  createPendingMerchRequestViaArtistApi,
  extractOnboardingProductId,
  rejectOnboardingViaAdminApi,
} from '../helpers/onboarding';

test.describe('Onboarding public visibility', () => {
  test.beforeAll(async () => {
    await prepareOnboardingSuite();
  });

  test('fan sees only active products across listing/search/storefront/detail', async ({ page }) => {
    const stamp = makeStamp('pw-onb-fan');

    await loginAdmin(page);
    const { artistId, artistHandle } = await ensureArtistIdentityForAdmin(page);

    const activeTitle = `${stamp}-active`;
    const pendingTitle = `${stamp}-pending`;
    const inactiveTitle = `${stamp}-inactive`;
    const rejectedTitle = `${stamp}-rejected`;

    const { productId: activeProductId } = await createAdminProductWithStatus(page, {
      artistId,
      title: activeTitle,
      status: 'active',
    });
    const { productId: pendingProductId } = await createAdminProductWithStatus(page, {
      artistId,
      title: pendingTitle,
      status: 'pending',
    });
    const { productId: inactiveProductId } = await createAdminProductWithStatus(page, {
      artistId,
      title: inactiveTitle,
      status: 'inactive',
    });
    const { productId: rejectedProductId } = await createAdminProductWithStatus(page, {
      artistId,
      title: rejectedTitle,
      status: 'rejected',
    });

    await loginBuyer(page);
    await gotoApp(page, '/products', { waitUntil: 'domcontentloaded' });
    await page.getByPlaceholder(/search artists, merchandise, vibes/i).fill(stamp);

    const catalogCards = page.getByTestId('product-catalog-card');
    const catalogCardByTitle = (title: string) => catalogCards.filter({ hasText: title });

    await expect(catalogCardByTitle(activeTitle)).toHaveCount(1);
    await expect(catalogCardByTitle(activeTitle)).toBeVisible({ timeout: 15000 });
    await expect(catalogCardByTitle(pendingTitle)).toHaveCount(0);
    await expect(catalogCardByTitle(inactiveTitle)).toHaveCount(0);
    await expect(catalogCardByTitle(rejectedTitle)).toHaveCount(0);

    await gotoApp(page, `/artists/${artistHandle}`, { waitUntil: 'domcontentloaded' });

    const artistCards = page.getByTestId('product-card');
    const artistCardByTitle = (title: string) => artistCards.filter({ hasText: title });

    await expect(artistCardByTitle(activeTitle)).toHaveCount(1);
    await expect(artistCardByTitle(activeTitle)).toBeVisible({ timeout: 15000 });
    await expect(artistCardByTitle(pendingTitle)).toHaveCount(0);
    await expect(artistCardByTitle(inactiveTitle)).toHaveCount(0);
    await expect(artistCardByTitle(rejectedTitle)).toHaveCount(0);

    await gotoApp(page, `/products/${activeProductId}`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('product-title')).toContainText(activeTitle, { timeout: 15000 });

    for (const blockedId of [pendingProductId, inactiveProductId, rejectedProductId]) {
      await gotoApp(page, `/products/${blockedId}`, { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { name: /not found/i })).toBeVisible({
        timeout: 15000,
      });
    }
  });

  test('artist sees rejection reason on rejected merch while public storefront remains unaffected', async ({
    page,
  }) => {
    const merchName = makeStamp('pw-onb-reject');
    const rejectionReason = `Rejected by smoke ${Date.now()} - missing fit for launch.`;

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
    const row = page.getByTestId('artist-product-row').filter({ hasText: merchName }).first();
    await expect(row).toBeVisible({ timeout: 20000 });
    await expect(row.getByTestId('artist-product-status')).toContainText(/rejected/i);
    await expect(row.getByTestId('artist-merch-rejection-reason')).toContainText(rejectionReason);

    await loginBuyer(page);
    await gotoApp(page, '/products', { waitUntil: 'domcontentloaded' });
    await page.getByPlaceholder(/search artists, merchandise, vibes/i).fill(merchName);
    await expect(page.getByTestId('product-catalog-card').filter({ hasText: merchName })).toHaveCount(0);
  });
});


