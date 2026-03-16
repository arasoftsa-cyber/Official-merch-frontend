import { test, expect } from '../helpers/session';
import { gotoApp } from '../helpers/auth';

const PHONE_HELPER_TEXT = 'Enter your 10-digit mobile number. Country code +91 is assumed.';

test.describe('Label artist access request modal', () => {
  test('submits the canonical artist request payload contract', async ({ labelPage }) => {
    let submissionCount = 0;
    let capturedPayload: Record<string, unknown> | null = null;

    await labelPage.route('**/api/artist-access-requests**', async (route) => {
      if (route.request().method() !== 'POST') {
        await route.continue();
        return;
      }

      submissionCount += 1;
      capturedPayload = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          request_id: 'label-request-1',
          created_at: '2026-03-16T00:00:00.000Z',
        }),
      });
    });

    await gotoApp(labelPage, '/partner/label');
    await labelPage.getByRole('button', { name: /add artist/i }).click();

    await expect(labelPage.getByRole('heading', { name: /artist access request/i })).toBeVisible({
      timeout: 10000,
    });
    await expect(labelPage.locator('#apply-artist-phone-helper')).toContainText(PHONE_HELPER_TEXT);

    const stamp = Date.now();
    await labelPage.getByLabel(/artist name/i).fill(`Label Artist ${stamp}`);
    await labelPage.getByLabel(/^handle/i).fill(`@label-artist-${stamp}`);
    await labelPage.getByLabel(/^email/i).fill(`label.artist.${stamp}@example.invalid`);
    await labelPage.getByTestId('apply-artist-phone-input').fill('9876543210');
    await labelPage.getByRole('button', { name: /add row/i }).click();
    await labelPage.getByLabel(/platform/i).first().selectOption('instagram');
    await labelPage.getByLabel(/url/i).first().fill('https://instagram.com/labelartist');
    await labelPage.getByLabel(/about me/i).fill('Shared label modal submission');
    await labelPage.getByLabel(/message for fans/i).fill('Welcome from the label flow');

    await labelPage.getByTestId('apply-artist-submit').click();

    await expect.poll(() => submissionCount).toBe(1);
    expect(capturedPayload).toEqual({
      artist_name: `Label Artist ${stamp}`,
      handle: `label-artist-${stamp}`,
      email: `label.artist.${stamp}@example.invalid`,
      phone: '9876543210',
      requested_plan_type: 'basic',
      about_me: 'Shared label modal submission',
      message_for_fans: 'Welcome from the label flow',
      socials: [
        {
          platform: 'instagram',
          url: 'https://instagram.com/labelartist',
        },
      ],
    });
    expect(capturedPayload).not.toHaveProperty('contact_email');
    expect(capturedPayload).not.toHaveProperty('contact_phone');
    expect(capturedPayload).not.toHaveProperty('pitch');
    expect(capturedPayload).not.toHaveProperty('label_id');
    expect(capturedPayload).not.toHaveProperty('labelId');

    await expect(
      labelPage.getByText(/artist access request submitted\. admin will review\./i)
    ).toBeVisible({ timeout: 10000 });
  });
});
