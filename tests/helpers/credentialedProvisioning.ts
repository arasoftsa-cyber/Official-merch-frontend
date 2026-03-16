import type { Page } from '@playwright/test';
import { assertOkResponse, getApiUrl } from './api';
import { getCredentialedAccount } from '../_env';

type PartnerRole = 'admin' | 'artist' | 'label';

const readAccessToken = (payload: any): string =>
  String(
    payload?.accessToken ??
      payload?.token ??
      payload?.data?.accessToken ??
      payload?.access_token ??
      ''
  ).trim();

const partnerCredentialsFor = (role: PartnerRole) => {
  if (role === 'admin') return getCredentialedAccount('admin');
  if (role === 'artist') return getCredentialedAccount('artist');
  return getCredentialedAccount('label');
};

export const getCredentialedPartnerAccessToken = async (page: Page, role: PartnerRole) => {
  const { email, password } = partnerCredentialsFor(role);
  const response = await page.request.post(getApiUrl('/api/auth/partner/login'), {
    headers: { Accept: 'application/json' },
    data: { email, password },
  });
  await assertOkResponse(response, `Credentialed ${role} login`);
  const payload = await response.json().catch(() => null);
  const accessToken = readAccessToken(payload);
  if (!accessToken) {
    throw new Error(`Credentialed ${role} login returned no access token.`);
  }
  return accessToken;
};

const readArtists = (payload: any): any[] => {
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.artists)) return payload.artists;
  if (Array.isArray(payload)) return payload;
  return [];
};

export const ensureCredentialedArtistIdentityForAdmin = async (page: Page) => {
  const accessToken = await getCredentialedPartnerAccessToken(page, 'admin');
  const artistsResponse = await page.request.get(getApiUrl('/api/admin/artists'), {
    headers: { Accept: 'application/json', Authorization: `Bearer ${accessToken}` },
  });
  await assertOkResponse(artistsResponse, 'Load admin artists');
  const artistsPayload = await artistsResponse.json().catch(() => null);
  const artists = readArtists(artistsPayload);
  const firstArtist = artists[0];
  const artistId = String(firstArtist?.id || '').trim();
  const artistHandle = String(firstArtist?.handle || '').trim();
  if (artistId && artistHandle) {
    return { artistId, artistHandle };
  }

  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`.toLowerCase();
  const handle = `pw-live-${suffix}`.replace(/[^a-z0-9-]/g, '-').slice(0, 48);
  const createResponse = await page.request.post(getApiUrl('/api/admin/provisioning/create-artist'), {
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    data: {
      handle,
      name: `PW Live ${handle}`,
      theme: {},
    },
  });
  await assertOkResponse(createResponse, 'Create credentialed artist');
  const payload = await createResponse.json().catch(() => null);
  const createdArtistId = String(payload?.artist?.id || '').trim();
  const createdArtistHandle = String(payload?.artist?.handle || handle).trim();
  if (!createdArtistId || !createdArtistHandle) {
    throw new Error(`Invalid create-artist payload: ${JSON.stringify(payload ?? null)}`);
  }
  return { artistId: createdArtistId, artistHandle: createdArtistHandle };
};

export const createAdminProductWithStatusViaAdminApi = async (
  page: Page,
  input: {
    artistId: string;
    title: string;
    status: 'pending' | 'inactive' | 'active' | 'rejected';
  }
) => {
  const accessToken = await getCredentialedPartnerAccessToken(page, 'admin');
  const response = await page.request.post(getApiUrl('/api/admin/products'), {
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    data: {
      artistId: input.artistId,
      title: input.title,
      description: `Credentialed smoke product ${input.title}`,
      status: input.status,
      priceCents: 1999,
      stock: 10,
      size: 'M',
      color: 'Black',
      sku: `PW-LIVE-${input.status}-${Date.now()}`,
    },
  });
  await assertOkResponse(response, `Create credentialed product ${input.title}`);
  const payload = await response.json().catch(() => null);
  const productId = String(
    payload?.productId || payload?.product_id || payload?.id || payload?.product?.id || ''
  ).trim();
  if (!productId) {
    throw new Error(`Create credentialed product returned no productId: ${JSON.stringify(payload ?? null)}`);
  }
  return { productId };
};
