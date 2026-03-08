import { test, expect } from '@playwright/test';
import { ADMIN_EMAIL, ADMIN_PASSWORD } from '../_env';
import { gotoApp, loginFanWithCredentials } from '../helpers/auth';
import { expectRedirectToPortalLogin } from '../helpers/assertions';

test.describe('Auth role routing', () => {
  test('fan portal rejects partner/admin credentials', async ({ page }) => {
    test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, 'Missing admin credentials');
    const partnerEmail = ADMIN_EMAIL;
    const partnerPassword = ADMIN_PASSWORD;

    await loginFanWithCredentials(page, partnerEmail, partnerPassword, { expectRejection: true });
    await expect(page).not.toHaveURL(/\/partner\/(admin|artist|label)/, { timeout: 15000 });
    await expect(page).toHaveURL(/\/fan\/login/, { timeout: 15000 });
    const partnerBanner = page.getByText(/this account is for the partner portal|partner portal/i).first();
    const partnerLink = page.getByRole('link', { name: /partner login|go to partner login/i }).first();
    const partnerButton = page.getByRole('button', { name: /partner login|go to partner login/i }).first();

    const bannerCount = await partnerBanner.count().catch(() => 0);
    const linkCount = await partnerLink.count().catch(() => 0);
    const buttonCount = await partnerButton.count().catch(() => 0);

    if (bannerCount > 0) {
      await expect(partnerBanner).toBeVisible({ timeout: 15000 });
    } else if (linkCount > 0) {
      await expect(partnerLink).toBeVisible({ timeout: 15000 });
    } else if (buttonCount > 0) {
      await expect(partnerButton).toBeVisible({ timeout: 15000 });
    } else {
      await expect(
        page.getByText(/role_not_allowed|not allowed|unauthorized|forbidden/i).first()
      ).toBeVisible({ timeout: 15000 });
    }

    await gotoApp(page, '/partner/admin', { waitUntil: 'domcontentloaded', authRetry: false });
    await expectRedirectToPortalLogin(page, '/partner/admin');
  });
});
