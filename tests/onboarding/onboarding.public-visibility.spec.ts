import { test, expect } from '@playwright/test';
import { loginAdmin, loginArtist, loginBuyer } from '../helpers/auth';
import { gotoApp } from '../helpers/navigation';
import {
  makeStamp,
  gotoArtistProducts,
  rejectPendingMerchViaAdminUi,
  submitArtistMerchRequestViaUi,
} from '../helpers/onboarding-flow';
import { prepareOnboardingSuite } from '../helpers/onboarding-flow';
import {
  ensureLocalTestSupportSeed,
  seedLocalProductWithStatus,
} from '../helpers/localTestSupport';

test.describe('Onboarding public visibility', () => {
  test.beforeAll(async () => {
    await prepareOnboardingSuite();
  });

  test('fan sees only active products across listing/search/storefront/detail', async ({ page }) => {
    const stamp = makeStamp('pw-onb-fan');

    const seeded = await ensureLocalTestSupportSeed();
    const { artistId, artistHandle } = seeded.artist;

    const activeTitle = `${stamp}-active`;
    const pendingTitle = `${stamp}-pending`;
    const inactiveTitle = `${stamp}-inactive`;
    const rejectedTitle = `${stamp}-rejected`;

    const { productId: activeProductId } = await seedLocalProductWithStatus({
      artistId,
      title: activeTitle,
      status: 'active',
    });
    const { productId: pendingProductId } = await seedLocalProductWithStatus({
      artistId,
      title: pendingTitle,
      status: 'pending',
    });
    const { productId: inactiveProductId } = await seedLocalProductWithStatus({
      artistId,
      title: inactiveTitle,
      status: 'inactive',
    });
    const { productId: rejectedProductId } = await seedLocalProductWithStatus({
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

    await loginArtist(page);
    await gotoArtistProducts(page);
    const { productId } = await submitArtistMerchRequestViaUi(page, {
      merchName,
      merchStory: `Rejection path story for ${merchName}.`,
      skuTestIds: ['artist-sku-hoodie'],
    });
    expect(productId.length).toBeGreaterThan(0);

    await loginAdmin(page);
    await rejectPendingMerchViaAdminUi(page, { title: merchName, rejectionReason });

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


