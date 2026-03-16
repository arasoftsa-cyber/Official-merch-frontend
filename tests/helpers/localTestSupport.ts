import { request as playwrightRequest } from '@playwright/test';
import { getApiUrl, readResponseSnippet } from './api';

const PLAYWRIGHT_PROFILE = String(process.env.PLAYWRIGHT_PROFILE || 'local').trim().toLowerCase();
const IS_LOCAL_PROFILE = PLAYWRIGHT_PROFILE === 'local';
const TEST_SUPPORT_KEY = String(process.env.PLAYWRIGHT_TEST_SUPPORT_KEY || 'om-playwright-local').trim();

type BootstrapItems = {
  adminUser: { id: string; email: string };
  buyerUser: { id: string; email: string };
  artistUser: { id: string; email: string };
  labelUser: { id: string; email: string };
  artist: { id: string; handle: string; artistHandle?: string; name?: string };
  label: { id: string; handle: string; labelHandle?: string; name?: string };
  product: { id: string; title: string };
  variant: { id: string; sku: string };
  drop: { id: string; handle: string };
  order: { id: string };
};

let cachedBootstrap: BootstrapItems | null = null;

const ensureLocalProfile = () => {
  if (!IS_LOCAL_PROFILE) {
    throw new Error(
      `Local test-support is only available for PLAYWRIGHT_PROFILE=local; received '${PLAYWRIGHT_PROFILE || 'unset'}'.`
    );
  }
};

const createSupportContext = () =>
  playwrightRequest.newContext({
    extraHTTPHeaders: {
      Accept: 'application/json',
      'x-playwright-test-support-key': TEST_SUPPORT_KEY,
    },
  });

export const ensureLocalTestSupportSeed = async (): Promise<BootstrapItems> => {
  ensureLocalProfile();
  if (cachedBootstrap) {
    return cachedBootstrap;
  }

  const context = await createSupportContext();
  try {
    const response = await context.post(getApiUrl('/api/test-support/playwright/bootstrap'));
    if (!response.ok()) {
      const snippet = await readResponseSnippet(response);
      const hint =
        response.status() === 404
          ? ' Local backend is missing /api/test-support/playwright/bootstrap; restart it on the updated code.'
          : '';
      throw new Error(
        `Local test-support bootstrap failed (${response.status()}): ${snippet}${hint}`
      );
    }
    const payload = await response.json().catch(() => null);
    const items = payload?.items ?? null;
    if (!items?.artist?.id || !items?.artist?.handle) {
      throw new Error(`Local test-support bootstrap returned invalid payload: ${JSON.stringify(payload ?? null)}`);
    }
    cachedBootstrap = {
      ...(items as BootstrapItems),
      artist: {
        ...(items.artist as BootstrapItems['artist']),
        handle: String(items.artist.handle || items.artist.artistHandle || '').trim(),
        artistHandle: String(items.artist.artistHandle || items.artist.handle || '').trim(),
      },
      label: {
        ...(items.label as BootstrapItems['label']),
        handle: String(items.label.handle || items.label.labelHandle || '').trim(),
        labelHandle: String(items.label.labelHandle || items.label.handle || '').trim(),
      },
    };
    return cachedBootstrap;
  } finally {
    await context.dispose();
  }
};

export const seedLocalProductWithStatus = async (input: {
  artistId?: string;
  title: string;
  status: 'pending' | 'inactive' | 'active' | 'rejected';
  description?: string;
}) => {
  ensureLocalProfile();
  const base = await ensureLocalTestSupportSeed();
  const context = await createSupportContext();
  try {
    const response = await context.post(getApiUrl('/api/test-support/playwright/products'), {
      data: {
        artistId: input.artistId || base.artist.id,
        title: input.title,
        status: input.status,
        description: input.description,
      },
    });
    if (!response.ok()) {
      const snippet = await readResponseSnippet(response);
      const hint =
        response.status() === 404
          ? ' Local backend is missing /api/test-support/playwright/products; restart it on the updated code.'
          : '';
      throw new Error(
        `Local test-support product seed failed for ${input.title} (${response.status()}): ${snippet}${hint}`
      );
    }
    const payload = await response.json().catch(() => null);
    const items = payload?.items ?? null;
    const productId = String(items?.productId || '').trim();
    const artistId = String(items?.artistId || '').trim();
    const artistHandle = String(items?.artistHandle || '').trim();
    if (!productId || !artistId) {
      throw new Error(`Local test-support product seed returned invalid payload: ${JSON.stringify(payload ?? null)}`);
    }
    return {
      productId,
      artistId,
      artistHandle: artistHandle || base.artist.handle,
    };
  } finally {
    await context.dispose();
  }
};
