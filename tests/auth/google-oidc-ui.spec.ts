import { test, expect } from '@playwright/test';
import { UI_BASE_URL } from '../_env';

test.describe('Google OIDC entry points', () => {
  test('fan login renders Google button', async ({ page }) => {
    await page.goto(`${UI_BASE_URL}/fan/login?returnTo=%2Ffan`, {
      waitUntil: 'domcontentloaded',
    });
    await expect(page.getByTestId('fan-login-google')).toBeVisible();
    await expect(page.getByTestId('fan-login-google')).toContainText(/continue with google/i);
  });

  test('fan register renders Google button', async ({ page }) => {
    await page.goto(`${UI_BASE_URL}/fan/register?returnTo=%2Ffan`, {
      waitUntil: 'domcontentloaded',
    });
    await expect(page.getByTestId('fan-register-google')).toBeVisible();
    await expect(page.getByTestId('fan-register-google')).toContainText(/continue with google/i);
  });

  test('partner login renders Google button', async ({ page }) => {
    await page.goto(`${UI_BASE_URL}/partner/login?returnTo=%2Fpartner%2Fdashboard`, {
      waitUntil: 'domcontentloaded',
    });
    await expect(page.getByTestId('partner-login-google')).toBeVisible();
    await expect(
      page.getByText(/for approved partner\/admin accounts only/i).first()
    ).toBeVisible();
  });

  test('blocked cross-portal Google case shows readable fan guidance', async ({ page }) => {
    await page.goto(
      `${UI_BASE_URL}/fan/login?portalError=partner_account&message=${encodeURIComponent(
        'This account belongs to the Partner Portal. Use partner login.'
      )}`,
      { waitUntil: 'domcontentloaded' }
    );

    const alert = page.getByRole('alert').first();
    await expect(alert).toBeVisible();
    await expect(alert).toContainText(/partner portal/i);
    await expect(page.getByTestId('fan-login-partner-link')).toBeVisible();
  });
});
