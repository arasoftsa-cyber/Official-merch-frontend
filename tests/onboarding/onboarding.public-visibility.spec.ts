import { test, expect } from '@playwright/test';
import { gotoApp, loginAdmin, loginBuyer } from '../helpers/auth';
import {
  createAdminProductWithStatus,
  ensureArtistIdentityForAdmin,
  makeStamp,
} from '../helpers/onboarding-flow';
import { prepareOnboardingSuite } from '../helpers/onboarding-flow';

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
    await expect(page.getByText(activeTitle)).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(pendingTitle)).toHaveCount(0);
    await expect(page.getByText(inactiveTitle)).toHaveCount(0);
    await expect(page.getByText(rejectedTitle)).toHaveCount(0);

    await gotoApp(page, `/artists/${artistHandle}`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByText(activeTitle)).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(pendingTitle)).toHaveCount(0);
    await expect(page.getByText(inactiveTitle)).toHaveCount(0);
    await expect(page.getByText(rejectedTitle)).toHaveCount(0);

    await gotoApp(page, `/products/${activeProductId}`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('product-title')).toContainText(activeTitle, { timeout: 15000 });

    for (const blockedId of [pendingProductId, inactiveProductId, rejectedProductId]) {
      await gotoApp(page, `/products/${blockedId}`, { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { name: /not found/i })).toBeVisible({
        timeout: 15000,
      });
    }
  });
});


