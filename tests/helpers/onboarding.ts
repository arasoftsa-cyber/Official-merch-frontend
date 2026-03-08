import fs from 'node:fs';
import path from 'node:path';
import type { APIResponse, Page } from '@playwright/test';
import { request as playwrightRequest } from '@playwright/test';
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  ARTIST_EMAIL,
  ARTIST_PASSWORD,
  BUYER_EMAIL,
  BUYER_PASSWORD,
  LABEL_EMAIL,
  LABEL_PASSWORD,
} from '../_env';
import { getApiUrl } from './urls';

const FIXTURES_DIR = path.resolve(__dirname, '..', 'fixtures');

export const DESIGN_IMAGE_PATH = path.join(FIXTURES_DIR, 'listing-photo-1.png');
export const MARKETPLACE_IMAGE_PATHS = [
  path.join(FIXTURES_DIR, 'listing-photo-1.png'),
  path.join(FIXTURES_DIR, 'listing-photo-2.png'),
  path.join(FIXTURES_DIR, 'listing-photo-3.png'),
  path.join(FIXTURES_DIR, 'listing-photo-4.png'),
];

const readResponseSnippet = async (response: APIResponse) =>
  (await response.text().catch(() => '<unavailable>')).replace(/\s+/g, ' ').trim().slice(0, 600);

const readRoleFromWhoami = (payload: any) =>
  String(
    payload?.role ??
      (Array.isArray(payload?.roles) ? payload.roles[0] : null) ??
      payload?.user?.role ??
      ''
  )
    .trim()
    .toLowerCase();

const runSeedRoute = async (
  apiContext: Awaited<ReturnType<typeof playwrightRequest.newContext>>,
  routePath: string,
  seedPayload: Record<string, string>
) => {
  const response = await apiContext.post(getApiUrl(routePath), { data: seedPayload });
  const status = response.status();
  const snippet = await readResponseSnippet(response);

  if (!response.ok()) {
    return {
      ok: false as const,
      routePath,
      status,
      snippet,
    };
  }

  const payload = await response.json().catch(() => null);
  if (payload && payload.ok === false) {
    return {
      ok: false as const,
      routePath,
      status,
      snippet: JSON.stringify(payload),
    };
  }

  return {
    ok: true as const,
    routePath,
    status,
  };
};

const verifyPartnerRole = async (
  email: string,
  password: string,
  expectedRole: 'admin' | 'artist' | 'label'
) => {
  const context = await playwrightRequest.newContext({
    extraHTTPHeaders: { Accept: 'application/json' },
  });
  try {
    const loginResponse = await context.post(getApiUrl('/api/auth/partner/login'), {
      data: { email, password },
    });
    if (!loginResponse.ok()) {
      const snippet = await readResponseSnippet(loginResponse);
      throw new Error(
        `Onboarding smoke setup could not login ${expectedRole} account (${loginResponse.status()}): ${snippet}`
      );
    }

    const whoami = await context.get(getApiUrl('/api/auth/whoami'));
    if (!whoami.ok()) {
      const snippet = await readResponseSnippet(whoami);
      throw new Error(
        `Onboarding smoke setup could not verify ${expectedRole} role (${whoami.status()}): ${snippet}`
      );
    }

    const payload = await whoami.json().catch(() => null);
    const role = readRoleFromWhoami(payload);
    if (role !== expectedRole) {
      throw new Error(
        `Onboarding smoke setup expected ${expectedRole} role, got '${role || 'unknown'}' for ${email}`
      );
    }
  } finally {
    await context.dispose();
  }
};

const verifyFanRole = async (email: string, password: string) => {
  const context = await playwrightRequest.newContext({
    extraHTTPHeaders: { Accept: 'application/json' },
  });
  try {
    let loginResponse = await context.post(getApiUrl('/api/auth/fan/login'), {
      data: { email, password },
    });

    if (loginResponse.status() === 404) {
      loginResponse = await context.post(getApiUrl('/api/auth/login'), {
        data: { email, password },
      });
    }

    if (!loginResponse.ok()) {
      const snippet = await readResponseSnippet(loginResponse);
      throw new Error(
        `Onboarding smoke setup could not login fan/buyer account (${loginResponse.status()}): ${snippet}`
      );
    }

    const whoami = await context.get(getApiUrl('/api/auth/whoami'));
    if (!whoami.ok()) {
      const snippet = await readResponseSnippet(whoami);
      throw new Error(
        `Onboarding smoke setup could not verify fan/buyer role (${whoami.status()}): ${snippet}`
      );
    }

    const payload = await whoami.json().catch(() => null);
    const role = readRoleFromWhoami(payload);
    if (!role || role === 'artist' || role === 'admin' || role === 'label') {
      throw new Error(
        `Onboarding smoke setup expected non-artist fan/buyer role, got '${role || 'unknown'}' for ${email}`
      );
    }
  } finally {
    await context.dispose();
  }
};

const verifyArtistProductsLoad = async (email: string, password: string) => {
  const context = await playwrightRequest.newContext({
    extraHTTPHeaders: { Accept: 'application/json' },
  });
  try {
    const loginResponse = await context.post(getApiUrl('/api/auth/partner/login'), {
      data: { email, password },
    });
    if (!loginResponse.ok()) {
      const snippet = await readResponseSnippet(loginResponse);
      throw new Error(
        `Onboarding smoke setup could not login artist for product list verification (${loginResponse.status()}): ${snippet}`
      );
    }

    const productsResponse = await context.get(getApiUrl('/api/artist/products'));
    if (!productsResponse.ok()) {
      const snippet = await readResponseSnippet(productsResponse);
      throw new Error(
        `Onboarding smoke setup artist products endpoint failed (${productsResponse.status()}): ${snippet}`
      );
    }
  } finally {
    await context.dispose();
  }
};

const ensureFixture = (filePath: string) => {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing onboarding test fixture: ${filePath}`);
  }
};

export const ensureOnboardingFixtures = () => {
  ensureFixture(DESIGN_IMAGE_PATH);
  for (const imagePath of MARKETPLACE_IMAGE_PATHS) {
    ensureFixture(imagePath);
  }
};

export const ensureOnboardingSmokeSeed = async () => {
  const seedPayload = {
    adminEmail: ADMIN_EMAIL,
    adminPassword: ADMIN_PASSWORD,
    artistEmail: ARTIST_EMAIL,
    artistPassword: ARTIST_PASSWORD,
    buyerEmail: BUYER_EMAIL,
    buyerPassword: BUYER_PASSWORD,
    labelEmail: LABEL_EMAIL,
    labelPassword: LABEL_PASSWORD,
  };

  const apiContext = await playwrightRequest.newContext({
    extraHTTPHeaders: { Accept: 'application/json' },
  });

  try {
    const loginResponse = await apiContext.post(getApiUrl('/api/auth/partner/login'), {
      data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    });
    if (!loginResponse.ok()) {
      const snippet = await readResponseSnippet(loginResponse);
      throw new Error(
        `Onboarding smoke setup failed during admin auth (${loginResponse.status()}): ${snippet}`
      );
    }

    const seedRoutes = ['/api/dev/seed-ui-smoke', '/api/dev/seed-ui-smoke-product'];
    const routeErrors: string[] = [];
    let seeded = false;

    for (let i = 0; i < seedRoutes.length; i += 1) {
      const routePath = seedRoutes[i];
      const result = await runSeedRoute(apiContext, routePath, seedPayload);

      if (result.ok) {
        seeded = true;
        break;
      }

      const failure = `${routePath} (${result.status}): ${result.snippet}`;
      routeErrors.push(failure);

      const is404 = result.status === 404;
      const hasFallback = i < seedRoutes.length - 1;
      if (!is404 || !hasFallback) {
        break;
      }
    }

    if (!seeded) {
      throw new Error(
        `Onboarding smoke setup failed across supported seed routes: ${routeErrors.join(' | ')}`
      );
    }

    await verifyPartnerRole(ADMIN_EMAIL, ADMIN_PASSWORD, 'admin');
    await verifyPartnerRole(ARTIST_EMAIL, ARTIST_PASSWORD, 'artist');
    await verifyFanRole(BUYER_EMAIL, BUYER_PASSWORD);
    await verifyArtistProductsLoad(ARTIST_EMAIL, ARTIST_PASSWORD);
  } finally {
    await apiContext.dispose();
  }
};

export const createPendingMerchRequestViaArtistApi = async (
  page: Page,
  {
    merchName,
    merchStory,
    skuTypes = ['regular_tshirt'],
  }: {
    merchName: string;
    merchStory: string;
    skuTypes?: string[];
  }
) => {
  ensureOnboardingFixtures();
  const imageBuffer = fs.readFileSync(DESIGN_IMAGE_PATH);
  const response = await page.request.post(getApiUrl('/api/artist/products/onboarding'), {
    multipart: {
      merch_name: merchName,
      merch_story: merchStory,
      sku_types: JSON.stringify(skuTypes),
      design_image: {
        name: path.basename(DESIGN_IMAGE_PATH),
        mimeType: 'image/png',
        buffer: imageBuffer,
      },
    },
  });
  if (!response.ok()) {
    const snippet = await readResponseSnippet(response);
    throw new Error(`Create pending merch failed (${response.status()}): ${snippet}`);
  }
  return response.json().catch(() => ({}));
};

export const uploadMarketplaceImages = async (page: Page, count: number) => {
  ensureOnboardingFixtures();
  const files = MARKETPLACE_IMAGE_PATHS.slice(0, Math.max(0, count));
  if (files.length === 0) {
    throw new Error('uploadMarketplaceImages requires at least one fixture image.');
  }
  await page.getByTestId('admin-marketplace-images-input').setInputFiles(files);
};
