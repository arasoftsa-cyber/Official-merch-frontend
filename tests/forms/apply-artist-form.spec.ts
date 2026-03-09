import path from 'path';
import { test, expect, type Page } from '@playwright/test';
import { UI_BASE_URL } from '../_env';

const APPLY_ARTIST_PATH = '/apply/artist';
const VALID_PHONE = '9876543210';
const INVALID_PHONE_MESSAGE = 'Enter a valid 10-digit Indian mobile number';
const REQUIRED_PHONE_MESSAGE = 'Phone number is required';
const PHONE_HELPER_TEXT = 'Enter your 10-digit mobile number. Country code +91 is assumed.';

const openApplyArtist = async (page: Page) => {
  await page.goto(`${UI_BASE_URL}${APPLY_ARTIST_PATH}`, { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(/\/apply\/artist/, { timeout: 15000 });
};

const fillRequiredFields = async (page: Page, phoneValue: string, stamp = Date.now()) => {
  await page.getByLabel(/artist name/i).fill(`UX Artist ${stamp}`);
  await page.getByLabel(/^handle/i).fill(`@ux-artist-${stamp}`);
  await page.getByLabel(/^email/i).fill(`ux.artist.${stamp}@example.invalid`);
  await page.getByTestId('apply-artist-phone-input').fill(phoneValue);
};

const extractMultipartField = (postData: string, field: string): string => {
  const re = new RegExp(`name="${field}"\\r?\\n\\r?\\n([^\\r\\n]+)`, 'i');
  return postData.match(re)?.[1]?.trim() ?? '';
};

const expectPhoneValidationFailure = async (page: Page, phoneValue: string, expectedMessage: string) => {
  let requestCount = 0;
  await page.route('**/api/artist-access-requests**', async (route) => {
    requestCount += 1;
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    });
  });

  await openApplyArtist(page);
  await fillRequiredFields(page, phoneValue);
  await page.getByTestId('apply-artist-submit').click();

  const phoneInput = page.getByTestId('apply-artist-phone-input');
  await expect(phoneInput).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#apply-artist-phone-helper')).toContainText(expectedMessage);
  await expect(page.getByText(/request submitted/i)).toHaveCount(0);
  await expect.poll(() => requestCount).toBe(0);
};

test.describe('Apply artist form UX', () => {
  test('rejects +91-prefixed input', async ({ page }) => {
    await expectPhoneValidationFailure(page, '+919876543210', INVALID_PHONE_MESSAGE);
  });

  test('rejects fewer than 10 digits', async ({ page }) => {
    await expectPhoneValidationFailure(page, '98765', INVALID_PHONE_MESSAGE);
  });

  test('rejects more than 10 digits', async ({ page }) => {
    await expectPhoneValidationFailure(page, '987654321012', INVALID_PHONE_MESSAGE);
  });

  test('rejects non-digit input', async ({ page }) => {
    await expectPhoneValidationFailure(page, 'abcd1234ef', INVALID_PHONE_MESSAGE);
  });

  test('clears profile photo input and form state after successful submit', async ({ page }) => {
    const fixturePath = path.resolve(__dirname, '..', 'fixtures', 'listing-photo-1.png');

    await page.route('**/api/artist-access-requests**', async (route) => {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
    });

    await openApplyArtist(page);
    await fillRequiredFields(page, VALID_PHONE);

    const basicPlanButton = page.locator('button[type="button"]').filter({ hasText: /basic/i }).first();
    const advancedPlanButton = page.locator('button[type="button"]').filter({ hasText: /advanced/i }).first();
    await advancedPlanButton.click();
    await expect(advancedPlanButton).toHaveClass(/ring-4/);

    await page.getByRole('button', { name: /add row/i }).click();
    await page.getByLabel(/platform/i).first().selectOption('instagram');
    await page.getByLabel(/url/i).first().fill('https://instagram.com/uxartist');
    await page.getByLabel(/about me/i).fill('Test about me');
    await page.getByLabel(/message for fans/i).fill('Test message for fans');

    const profilePhotoInput = page.getByTestId('apply-artist-profile-photo-input');
    await profilePhotoInput.setInputFiles(fixturePath);
    await expect(profilePhotoInput).not.toHaveValue('');

    const submitResponse = page.waitForResponse((response) => {
      return (
        response.request().method() === 'POST' &&
        response.url().includes('/api/artist-access-requests') &&
        response.status() === 201
      );
    });
    await page.getByTestId('apply-artist-submit').click();
    await submitResponse;
    await expect(page.getByText(/request submitted/i)).toBeVisible({ timeout: 10000 });

    await expect(page.getByLabel(/artist name/i)).toHaveValue('');
    await expect(page.getByLabel(/^handle/i)).toHaveValue('');
    await expect(page.getByLabel(/^email/i)).toHaveValue('');
    await expect(page.getByTestId('apply-artist-phone-input')).toHaveValue('');
    await expect(page.getByLabel(/about me/i)).toHaveValue('');
    await expect(page.getByLabel(/message for fans/i)).toHaveValue('');
    await expect(profilePhotoInput).toHaveValue('');
    await expect(page.getByLabel(/platform/i)).toHaveCount(0);
    await expect(page.locator('#apply-artist-phone-helper')).toContainText(PHONE_HELPER_TEXT);
    await expect(basicPlanButton).toHaveClass(/ring-4/);
    await expect(advancedPlanButton).not.toHaveClass(/ring-4/);
  });

  test('does not reset values on failed submit', async ({ page }) => {
    const fixturePath = path.resolve(__dirname, '..', 'fixtures', 'listing-photo-1.png');
    let requestCount = 0;

    await page.route('**/api/artist-access-requests**', async (route) => {
      requestCount += 1;
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'validation', message: 'validation_error' }),
      });
    });

    await openApplyArtist(page);
    const stamp = Date.now();
    await fillRequiredFields(page, VALID_PHONE, stamp);

    await page.locator('button[type="button"]').filter({ hasText: /advanced/i }).first().click();
    await page.getByRole('button', { name: /add row/i }).click();
    await page.getByLabel(/platform/i).first().selectOption('instagram');
    await page.getByLabel(/url/i).first().fill('https://instagram.com/uxartist-fail');

    const profilePhotoInput = page.getByTestId('apply-artist-profile-photo-input');
    await profilePhotoInput.setInputFiles(fixturePath);
    await expect(profilePhotoInput).not.toHaveValue('');

    await page.getByTestId('apply-artist-submit').click();
    await expect.poll(() => requestCount).toBe(1);

    await expect(page.getByText(/unable to submit request/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/request submitted/i)).toHaveCount(0);

    await expect(page.getByLabel(/artist name/i)).toHaveValue(`UX Artist ${stamp}`);
    await expect(page.getByLabel(/^handle/i)).toHaveValue(`@ux-artist-${stamp}`);
    await expect(page.getByLabel(/^email/i)).toHaveValue(`ux.artist.${stamp}@example.invalid`);
    await expect(page.getByTestId('apply-artist-phone-input')).toHaveValue(VALID_PHONE);
    await expect(profilePhotoInput).not.toHaveValue('');
    await expect(page.getByLabel(/platform/i)).toHaveCount(1);
  });

  test('shows required message when phone is blank', async ({ page }) => {
    await expectPhoneValidationFailure(page, '   ', REQUIRED_PHONE_MESSAGE);
  });
});
