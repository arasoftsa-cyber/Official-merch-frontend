import { test, expect, type Page } from '@playwright/test';
import { UI_BASE_URL } from './_env';

const REGISTER_PATH = '/fan/register?returnTo=%2Ffan';
const GENERIC_SERVER_FALLBACK =
  "We couldn't create your account. Please review your details and try again.";

const openRegister = async (page: Page) => {
  await page.goto(`${UI_BASE_URL}${REGISTER_PATH}`, { waitUntil: 'domcontentloaded' });
};

const fillValidRegisterForm = async (page: Page) => {
  await page.getByTestId('fan-register-name').fill('Jane Doe');
  await page.getByTestId('fan-register-email').fill(`register+${Date.now()}@example.com`);
  await page.getByTestId('fan-register-password').fill('StrongPass1');
  await page.getByTestId('fan-register-confirm-password').fill('StrongPass1');
};

test.describe('Fan register UX', () => {
  test('renders helper text for each field by default', async ({ page }) => {
    await openRegister(page);

    await expect(
      page.getByText('Enter your full name as you want it shown on your profile.')
    ).toBeVisible();
    await expect(
      page.getByText("We'll use this email for login and order updates.")
    ).toBeVisible();
    await expect(
      page.getByText('Use at least 8 characters with 1 uppercase, 1 lowercase, and 1 number.')
    ).toBeVisible();
    await expect(page.getByText('Re-enter the same password.')).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);
  });

  test('shows readable email validation and clears when corrected', async ({ page }) => {
    await openRegister(page);

    const email = page.getByTestId('fan-register-email');
    await email.fill('invalid-email');
    await email.blur();

    await expect(page.getByText('Enter a valid email address')).toBeVisible();
    await expect(email).toHaveAttribute('aria-invalid', 'true');

    await email.fill('valid@example.com');
    await expect(page.getByText('Enter a valid email address')).toHaveCount(0);
    await expect(
      page.getByText("We'll use this email for login and order updates.")
    ).toBeVisible();
  });

  test('shows weak-password message and live checklist updates', async ({ page }) => {
    await openRegister(page);

    const password = page.getByTestId('fan-register-password');
    await password.fill('short');
    await password.blur();

    await expect(page.getByText('Password must be at least 8 characters')).toBeVisible();
    await expect(page.getByTestId('fan-register-password-check-8-characters')).toContainText('[ ]');

    await password.fill('StrongPass1');
    await expect(page.getByText('Password must be at least 8 characters')).toHaveCount(0);
    await expect(
      page.getByText('Use at least 8 characters with 1 uppercase, 1 lowercase, and 1 number.')
    ).toBeVisible();

    await expect(page.getByTestId('fan-register-password-check-8-characters')).toContainText('[ok]');
    await expect(page.getByTestId('fan-register-password-check-uppercase-letter')).toContainText('[ok]');
    await expect(page.getByTestId('fan-register-password-check-lowercase-letter')).toContainText('[ok]');
    await expect(page.getByTestId('fan-register-password-check-number')).toContainText('[ok]');
  });

  test('shows confirm-password mismatch with readable message', async ({ page }) => {
    await openRegister(page);

    await page.getByTestId('fan-register-password').fill('StrongPass1');
    const confirm = page.getByTestId('fan-register-confirm-password');
    await confirm.fill('WrongPass1');
    await confirm.blur();

    await expect(page.getByText('Passwords do not match')).toBeVisible();
    await expect(confirm).toHaveAttribute('aria-invalid', 'true');
  });

  test('maps raw backend validation keys to readable alert text', async ({ page }) => {
    await page.route('**/api/auth/register**', async (route) => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'validation_error' }),
      });
    });

    await openRegister(page);
    await fillValidRegisterForm(page);

    await page.getByTestId('fan-register-submit').click();

    const alert = page.getByRole('alert');
    await expect(alert).toBeVisible();
    await expect(alert).toContainText(GENERIC_SERVER_FALLBACK);
    await expect(page.getByText('validation_error')).toHaveCount(0);
  });

  test('submit button shows loading state, disables, and blocks duplicate submit', async ({ page }) => {
    let requestCount = 0;

    await page.route('**/api/auth/register**', async (route) => {
      requestCount += 1;
      await new Promise((resolve) => setTimeout(resolve, 700));
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'bad_request' }),
      });
    });

    await openRegister(page);
    await fillValidRegisterForm(page);

    const submitButton = page.getByTestId('fan-register-submit');
    await submitButton.click();

    await expect(submitButton).toBeDisabled();
    await expect(submitButton).toContainText('Creating account...');

    await page.keyboard.press('Enter');
    await page.waitForTimeout(150);
    expect(requestCount).toBe(1);

    await expect(page.getByRole('alert')).toContainText(GENERIC_SERVER_FALLBACK);
    await expect(submitButton).toContainText('Sign Up');
  });
});
