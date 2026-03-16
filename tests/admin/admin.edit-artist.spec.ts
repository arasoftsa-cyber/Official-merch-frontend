import { test, expect, type Page } from '@playwright/test';
import path from 'path';
import { loginAdmin } from '../helpers/auth';
import { gotoApp } from '../helpers/navigation';

type ArtistState = {
  id: string;
  name: string;
  handle: string;
  email: string;
  status: string;
  is_featured: boolean;
  phone: string;
  about: string;
  message_for_fans: string;
  profilePhotoUrl: string;
  socials: Array<{ platform: string; value: string; profileLink: string }>;
};

type SubscriptionState = {
  id: string;
  artistId: string;
  requestedPlanType: string;
  approvedPlanType: string;
  startDate: string;
  endDate: string;
  paymentMode: string;
  transactionId: string;
  status: string;
  approvedAt: string;
  approvedByAdminId: string;
};

const ARTIST_ID = 'artist-1';
const SUBSCRIPTION_ID = 'sub-1';

const createArtistState = (): ArtistState => ({
  id: ARTIST_ID,
  name: 'Artist One',
  handle: 'artistone',
  email: 'artist.one@example.com',
  status: 'active',
  is_featured: false,
  phone: '+49 123 000',
  about: 'Original about text',
  message_for_fans: 'Original fan message',
  profilePhotoUrl: 'https://cdn.example.com/original-profile.jpg',
  socials: [
    {
      platform: 'instagram',
      value: 'https://instagram.com/artistone',
      profileLink: 'https://instagram.com/artistone',
    },
  ],
});

const createSubscriptionState = (): SubscriptionState => ({
  id: SUBSCRIPTION_ID,
  artistId: ARTIST_ID,
  requestedPlanType: 'basic',
  approvedPlanType: 'advanced',
  startDate: '2026-01-01',
  endDate: '2026-12-31',
  paymentMode: 'online',
  transactionId: 'TX-123',
  status: 'active',
  approvedAt: '2026-01-01T00:00:00.000Z',
  approvedByAdminId: 'admin-1',
});

const setupAdminArtistMocks = async (page: Page) => {
  const artist = createArtistState();
  const subscription = createSubscriptionState();

  const state = {
    artistPatchCalls: 0,
    subscriptionPatchCalls: 0,
    mediaUploadCalls: 0,
    lastArtistPatch: null as Record<string, unknown> | null,
    lastSubscriptionPatch: null as Record<string, unknown> | null,
  };

  const buildCorsHeaders = (route: any) => {
    const requestHeaders = route.request().headers();
    const origin = requestHeaders?.origin || 'http://localhost:5173';
    const requestedHeaders =
      requestHeaders?.['access-control-request-headers'] ||
      'authorization,content-type,accept';
    return {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Methods': 'GET,POST,PATCH,PUT,OPTIONS',
      'Access-Control-Allow-Headers': requestedHeaders,
      Vary: 'Origin',
    };
  };

  const fulfillJson = async (route: any, status: number, payload: unknown) => {
    await route.fulfill({
      status,
      contentType: 'application/json',
      headers: buildCorsHeaders(route),
      body: JSON.stringify(payload),
    });
  };

  const fulfillPreflight = async (route: any) => {
    await route.fulfill({
      status: 204,
      headers: buildCorsHeaders(route),
      body: '',
    });
  };

  const artistDetailPayload = () => ({
    id: artist.id,
    name: artist.name,
    handle: artist.handle,
    email: artist.email,
    status: artist.status,
    is_featured: artist.is_featured,
    isFeatured: artist.is_featured,
    phone: artist.phone,
    about: artist.about,
    about_me: artist.about,
    message_for_fans: artist.message_for_fans,
    messageForFans: artist.message_for_fans,
    profile_photo_url: artist.profilePhotoUrl,
    profilePhotoUrl: artist.profilePhotoUrl,
    socials: artist.socials,
    statusOptions: ['active', 'inactive', 'rejected'],
    capabilities: {
      canEditName: true,
      canEditHandle: false,
      canEditEmail: true,
      canEditStatus: true,
      canEditFeatured: true,
      canEditPhone: true,
      canEditAboutMe: true,
      canEditMessageForFans: true,
      canEditSocials: true,
      canEditProfilePhoto: true,
      canUploadProfilePhoto: true,
    },
  });

  await page.route(/\/api\/media-assets(?:[/?#]|$)/i, async (route) => {
    const method = route.request().method();
    if (method === 'OPTIONS') {
      await fulfillPreflight(route);
      return;
    }
    if (method !== 'POST') {
      await fulfillJson(route, 405, { error: 'method_not_allowed' });
      return;
    }
    state.mediaUploadCalls += 1;
    await fulfillJson(route, 200, {
      id: 'media-1',
      publicUrl: 'https://cdn.example.com/uploaded-profile.jpg',
    });
  });

  await page.route(/\/api\/admin\/.+/i, async (route) => {
    const method = route.request().method();
    const url = route.request().url();
    if (method === 'OPTIONS') {
      await fulfillPreflight(route);
      return;
    }

    if (/\/api\/admin\/artist-subscriptions\/[^/]+(?:[/?#]|$)/i.test(url)) {
      if (method !== 'PATCH') {
        await fulfillJson(route, 405, { error: 'method_not_allowed' });
        return;
      }
      state.subscriptionPatchCalls += 1;
      const body = (route.request().postDataJSON() as any) || {};
      state.lastSubscriptionPatch = body;
      if (!Object.keys(body).length) {
        await fulfillJson(route, 400, { error: 'no_fields' });
        return;
      }
      Object.assign(subscription, body);
      await fulfillJson(route, 200, subscription);
      return;
    }

    if (/\/api\/admin\/artists\/[^/]+\/subscription(?:[/?#]|$)/i.test(url)) {
      if (method !== 'GET') {
        await fulfillJson(route, 405, { error: 'method_not_allowed' });
        return;
      }
      await fulfillJson(route, 200, subscription);
      return;
    }

    if (/\/api\/admin\/artists\/[^/]+(?:[/?#]|$)/i.test(url)) {
      if (method === 'GET') {
        await fulfillJson(route, 200, artistDetailPayload());
        return;
      }
      if (method === 'PATCH') {
        state.artistPatchCalls += 1;
        const body = (route.request().postDataJSON() as any) || {};
        state.lastArtistPatch = body;
        if (!Object.keys(body).length) {
          await fulfillJson(route, 400, { error: 'no_fields' });
          return;
        }
        if (Object.prototype.hasOwnProperty.call(body, 'name')) artist.name = String(body.name || '');
        if (Object.prototype.hasOwnProperty.call(body, 'email')) artist.email = String(body.email || '');
        if (Object.prototype.hasOwnProperty.call(body, 'status')) artist.status = String(body.status || '');
        if (Object.prototype.hasOwnProperty.call(body, 'is_featured')) {
          artist.is_featured = Boolean(body.is_featured);
        }
        if (Object.prototype.hasOwnProperty.call(body, 'phone')) artist.phone = String(body.phone || '');
        if (Object.prototype.hasOwnProperty.call(body, 'about')) artist.about = String(body.about || '');
        if (Object.prototype.hasOwnProperty.call(body, 'message_for_fans')) {
          artist.message_for_fans = String(body.message_for_fans || '');
        }
        if (Object.prototype.hasOwnProperty.call(body, 'socials') && Array.isArray(body.socials)) {
          artist.socials = body.socials.map((entry: any) => ({
            platform: String(entry?.platform || ''),
            value: String(entry?.value || entry?.profileLink || ''),
            profileLink: String(entry?.value || entry?.profileLink || ''),
          }));
        }
        if (Object.prototype.hasOwnProperty.call(body, 'profile_photo_url')) {
          artist.profilePhotoUrl = String(body.profile_photo_url || '');
        }
        await fulfillJson(route, 200, artistDetailPayload());
        return;
      }
      await fulfillJson(route, 405, { error: 'method_not_allowed' });
      return;
    }

    if (/\/api\/admin\/artists(?:[/?#]|$)/i.test(url)) {
      if (method !== 'GET') {
        await fulfillJson(route, 405, { error: 'method_not_allowed' });
        return;
      }
      await fulfillJson(route, 200, {
        items: [
          {
            id: artist.id,
            name: artist.name,
            handle: artist.handle,
            email: artist.email,
            status: artist.status,
            is_featured: artist.is_featured,
          },
        ],
      });
      return;
    }

    await route.fallback();
  });

  return state;
};

const openArtistEditModal = async (page: Page) => {
  await loginAdmin(page, { returnTo: '/partner/admin/artists' });
  await gotoApp(page, '/partner/admin/artists', { waitUntil: 'domcontentloaded' });
  const editButton = page.getByRole('button', { name: /^edit$/i }).first();
  await expect(editButton).toBeVisible({ timeout: 15000 });
  await editButton.click();
  await expect(page.getByRole('heading', { name: /edit artist/i })).toBeVisible({ timeout: 10000 });
};

const aboutField = (page: Page) => page.locator('label:has-text("About") textarea').first();
const messageForFansField = (page: Page) =>
  page.locator('label:has-text("Message For Fans") textarea').first();
const subscriptionStatusSelect = (page: Page) =>
  page.locator('label:has-text("Subscription Status") select').first();

test.describe('Admin artist edit modal', () => {
  test('loads existing artist values into modal form', async ({ page }) => {
    await setupAdminArtistMocks(page);
    await openArtistEditModal(page);

    await expect(page.getByLabel(/^name$/i)).toHaveValue('Artist One');
    await expect(page.getByLabel(/^email$/i)).toHaveValue('artist.one@example.com');
    await expect(page.getByLabel(/^phone$/i)).toHaveValue('+49 123 000');
    await expect(aboutField(page)).toHaveValue('Original about text');
    await expect(messageForFansField(page)).toHaveValue('Original fan message');
    await expect(page.getByTestId('admin-artist-featured-modal-toggle')).not.toBeChecked();
    await expect(page.getByPlaceholder('Platform').first()).toHaveValue('instagram');
    await expect(page.getByPlaceholder('URL / Handle').first()).toHaveValue(
      'https://instagram.com/artistone'
    );
  });

  test('changed phone/about/featured sends non-empty changed-field payload', async ({ page }) => {
    const state = await setupAdminArtistMocks(page);
    await openArtistEditModal(page);

    await page.getByLabel(/^phone$/i).fill('+49 555 999');
    await aboutField(page).fill('Updated about text');
    await page.getByTestId('admin-artist-featured-modal-toggle').check();
    await page.getByRole('button', { name: /save changes/i }).click();

    await expect.poll(() => state.artistPatchCalls).toBe(1);
    expect(state.lastArtistPatch).not.toBeNull();
    expect(state.lastArtistPatch?.phone).toBe('+49 555 999');
    expect(state.lastArtistPatch?.about).toBe('Updated about text');
    expect(state.lastArtistPatch?.is_featured).toBe(true);
    expect(state.lastArtistPatch?.name).toBeUndefined();
    expect(state.lastArtistPatch?.status).toBeUndefined();
    expect(state.lastArtistPatch?.socials).toBeUndefined();
    await expect.poll(() => state.subscriptionPatchCalls).toBe(0);
  });

  test('unchanged submit does not call update APIs and shows info message', async ({ page }) => {
    const state = await setupAdminArtistMocks(page);
    await openArtistEditModal(page);

    await page.getByRole('button', { name: /save changes/i }).click();

    await expect.poll(() => state.artistPatchCalls).toBe(0);
    await expect.poll(() => state.subscriptionPatchCalls).toBe(0);
    await expect(page.getByText(/no changes to save/i)).toBeVisible({ timeout: 10000 });
  });

  test('subscription-only change patches subscription without artist patch', async ({ page }) => {
    const state = await setupAdminArtistMocks(page);
    await openArtistEditModal(page);

    await subscriptionStatusSelect(page).selectOption('expired');
    await page.getByRole('button', { name: /save changes/i }).click();

    await expect.poll(() => state.artistPatchCalls).toBe(0);
    await expect.poll(() => state.subscriptionPatchCalls).toBe(1);
    expect(state.lastSubscriptionPatch).toEqual({ status: 'expired' });
  });

  test('profile photo file upload includes media fields in artist patch', async ({ page }) => {
    const state = await setupAdminArtistMocks(page);
    await openArtistEditModal(page);

    const imagePath = path.resolve(__dirname, '..', 'fixtures', 'listing-photo-1.png');
    await page.locator('input[type="file"]').first().setInputFiles(imagePath);
    await page.getByRole('button', { name: /save changes/i }).click();

    await expect.poll(() => state.mediaUploadCalls).toBe(1);
    await expect.poll(() => state.artistPatchCalls).toBe(1);
    expect(state.lastArtistPatch?.profile_photo_url).toBe('https://cdn.example.com/uploaded-profile.jpg');
    expect(state.lastArtistPatch?.profile_photo_media_asset_id).toBe('media-1');
  });
});
