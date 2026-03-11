import { test, expect } from '@playwright/test';
import { UI_BASE_URL } from '../_env';

test.describe('Password reset UI', () => {
  test('fan and partner login show forgot-password entry points', async ({ page }) => {
    await page.goto(`${UI_BASE_URL}/fan/login?returnTo=%2Ffan%2Forders`, {
      waitUntil: 'domcontentloaded',
    });
    await expect(page.getByTestId('fan-login-forgot-password')).toBeVisible();
    await expect(page.getByTestId('fan-login-forgot-password')).toHaveAttribute(
      'href',
      /\/forgot-password\?portal=fan/
    );

    await page.goto(`${UI_BASE_URL}/partner/login?returnTo=%2Fpartner%2Fadmin`, {
      waitUntil: 'domcontentloaded',
    });
    await expect(page.getByTestId('partner-login-forgot-password')).toBeVisible();
    await expect(page.getByTestId('partner-login-forgot-password')).toHaveAttribute(
      'href',
      /\/forgot-password\?portal=partner/
    );
  });

  test('forgot password submits neutral success message', async ({ page }) => {
    const capturedEmails: string[] = [];

    await page.route('**/api/auth/password/forgot', async (route) => {
      const payload = route.request().postDataJSON() as { email?: string };
      capturedEmails.push(String(payload?.email || ''));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
    });

    await page.goto(
      `${UI_BASE_URL}/forgot-password?portal=fan&returnTo=${encodeURIComponent('/fan/orders')}`,
      { waitUntil: 'domcontentloaded' }
    );
    await expect(page.getByTestId('forgot-password-email')).toBeVisible();
    await page.getByTestId('forgot-password-email').fill('  SOME.USER@Example.com ');
    await page.getByTestId('forgot-password-submit').click();

    await expect(
      page.getByText(/if an account exists for that email, a reset link has been sent/i)
    ).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/no account|user not found/i)).toHaveCount(0);
    await expect.poll(() => capturedEmails.length).toBe(1);
    expect(capturedEmails[0]).toBe('some.user@example.com');
  });

  test('reset password blocks submit when token is missing', async ({ page }) => {
    let resetCalls = 0;
    await page.route('**/api/auth/password/reset', async (route) => {
      resetCalls += 1;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
    });

    await page.goto(`${UI_BASE_URL}/reset-password`, { waitUntil: 'domcontentloaded' });
    await page.getByTestId('reset-password-new').fill('ValidPass123!');
    await page.getByTestId('reset-password-confirm').fill('ValidPass123!');
    await page.getByTestId('reset-password-submit').click();

    await expect(page.getByRole('alert')).toContainText(/token is missing or invalid/i);
    expect(resetCalls).toBe(0);
  });

  test('reset password shows invalid/expired token error and supports success path', async ({
    page,
  }) => {
    let callCount = 0;
    await page.route('**/api/auth/password/reset', async (route) => {
      callCount += 1;
      if (callCount === 1) {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'invalid_or_expired_token' }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
    });

    const validPassword = 'ValidPass123!';
    await page.goto(`${UI_BASE_URL}/reset-password?token=expired-token`, {
      waitUntil: 'domcontentloaded',
    });
    await page.getByTestId('reset-password-new').fill(validPassword);
    await page.getByTestId('reset-password-confirm').fill(validPassword);
    await page.getByTestId('reset-password-submit').click();

    await expect(page.getByRole('alert')).toContainText(/invalid or has expired/i);

    await page.goto(`${UI_BASE_URL}/reset-password?token=fresh-token`, {
      waitUntil: 'domcontentloaded',
    });
    await page.getByTestId('reset-password-new').fill(validPassword);
    await page.getByTestId('reset-password-confirm').fill(validPassword);
    await page.getByTestId('reset-password-submit').click();

    await expect(
      page.getByText(/password updated successfully\. you can now sign in with your new password\./i)
    ).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('link', { name: /back to login/i })).toBeVisible();
  });
});
