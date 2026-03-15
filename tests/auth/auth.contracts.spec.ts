import { expect, test } from '@playwright/test';
import { UI_BASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD } from '../_env';
import { gotoApp, loginAdmin, loginArtist, loginBuyer, loginFanWithCredentials, loginLabel } from '../helpers/auth';
import { expectRedirectToPortalLogin } from '../helpers/assertions';
import {
  getPortalLoginHref,
  getPortalLoginRoute,
  getRequestedAuthPortal,
  getRequestedReturnTo,
  normalizeAuthPortal,
  resolvePartnerEntryRedirect,
  resolvePortalIssue,
  resolvePortalIssueFromSearch,
  resolvePostLoginRedirect,
  toSafeReturnTo,
} from '../../src/shared/auth/routingPolicy';

const PUBLIC_ROUTES_WITH_CHROME = [
  '/fan/login',
  '/fan/register',
  '/partner/login',
  '/forgot-password?portal=fan',
  '/reset-password?token=smoke-token',
  '/artists',
  '/products',
  '/drops',
];

test.describe('Auth routing and access contracts', () => {
  test('redirect policy matrix resolves canonical destinations and safe fallbacks', async () => {
    const homeCases = [
      { portal: 'fan' as const, role: 'buyer', expected: '/fan' },
      { portal: 'partner' as const, role: 'artist', expected: '/partner/artist' },
      { portal: 'partner' as const, role: 'label', expected: '/partner/label' },
      { portal: 'partner' as const, role: 'admin', expected: '/partner/admin' },
      { role: 'admin', expected: '/partner/admin' },
    ];

    for (const { portal, role, expected } of homeCases) {
      expect(
        resolvePostLoginRedirect({
          portal,
          role,
          fallbackRoute: '/',
        })
      ).toBe(expected);
    }

    const returnToCases = [
      {
        label: 'allowed admin returnTo is preserved',
        input: {
          portal: 'partner' as const,
          role: 'admin',
          returnTo: '/partner/admin/orders',
          fallbackRoute: '/',
        },
        expected: '/partner/admin/orders',
      },
      {
        label: 'external returnTo falls back to role home',
        input: {
          portal: 'partner' as const,
          role: 'admin',
          returnTo: 'https://evil.example',
          fallbackRoute: '/',
        },
        expected: '/partner/admin',
      },
      {
        label: 'partner entry normalizes to canonical role home',
        input: {
          portal: 'partner' as const,
          role: 'artist',
          returnTo: '/partner',
          fallbackRoute: '/',
        },
        expected: '/partner/artist',
      },
      {
        label: 'disallowed partner target falls back to fan home',
        input: {
          role: 'buyer',
          returnTo: '/partner/admin',
          fallbackRoute: '/',
        },
        expected: '/fan',
      },
    ];

    for (const scenario of returnToCases) {
      expect(resolvePostLoginRedirect(scenario.input), scenario.label).toBe(scenario.expected);
    }

    expect(
      resolvePostLoginRedirect({
        search: '?returnTo=%2Fpartner%2Flogin',
        portal: 'partner',
        role: 'admin',
        fallbackRoute: '/',
      })
    ).toBe('/partner/admin');

    expect(
      resolvePostLoginRedirect({
        search: '?next=%2Ffan%2Forders',
        portal: 'fan',
        role: 'buyer',
        fallbackRoute: '/',
      })
    ).toBe('/fan/orders');

    expect(resolvePartnerEntryRedirect('buyer', '/')).toBe('/');
  });

  test('shared returnTo parsing and portal login helpers replace page-local sanitizers', async () => {
    expect(normalizeAuthPortal('partner')).toBe('partner');
    expect(normalizeAuthPortal('')).toBe('fan');
    expect(getRequestedAuthPortal('?portal=partner')).toBe('partner');
    expect(getRequestedAuthPortal('?portal=unknown')).toBe('fan');

    expect(getRequestedReturnTo('?returnTo=%2Ffan%2Forders')).toBe('/fan/orders');
    expect(getRequestedReturnTo('?next=%2Fpartner%2Fartist')).toBe('/partner/artist');
    expect(getRequestedReturnTo('?returnTo=https%3A%2F%2Fevil.example')).toBeNull();
    expect(getRequestedReturnTo('?returnTo=%E0%A4%A')).toBeNull();
    expect(getRequestedReturnTo('?returnTo=%2F%2Fexample.com')).toBeNull();

    expect(toSafeReturnTo('/partner/admin', { portal: 'fan', fallbackRoute: '/fan' })).toBe('/fan');
    expect(toSafeReturnTo('/fan/orders', { portal: 'partner', fallbackRoute: '/partner' })).toBe('/partner');
    expect(toSafeReturnTo('/fan/orders', { portal: 'fan', fallbackRoute: '/fan' })).toBe('/fan/orders');
    expect(toSafeReturnTo('/fan/login', { portal: 'fan', fallbackRoute: '/fan' })).toBe('/fan');
    expect(toSafeReturnTo(null, { portal: 'partner', fallbackRoute: '/partner' })).toBe('/partner');

    expect(getPortalLoginRoute('fan')).toBe('/fan/login');
    expect(getPortalLoginRoute('partner')).toBe('/partner/login');
    expect(getPortalLoginHref('fan', '/fan/orders')).toBe('/fan/login?returnTo=%2Ffan%2Forders');
    expect(getPortalLoginHref('partner', 'https://evil.example')).toBe('/partner/login?returnTo=%2Fpartner');
  });

  test('forgot password, fan register, and login flows use canonical portal fallbacks', async () => {
    expect(
      toSafeReturnTo(getRequestedReturnTo('?returnTo=%2Ffan%2Forders'), {
        portal: 'fan',
        fallbackRoute: '/fan',
      })
    ).toBe('/fan/orders');

    expect(
      toSafeReturnTo(getRequestedReturnTo('?returnTo=https%3A%2F%2Fevil.example'), {
        portal: 'fan',
        fallbackRoute: '/fan',
      })
    ).toBe('/fan');

    expect(
      toSafeReturnTo(getRequestedReturnTo('?returnTo=%2Fpartner%2Fartist'), {
        portal: 'fan',
        fallbackRoute: '/fan',
      })
    ).toBe('/fan');

    expect(
      toSafeReturnTo(getRequestedReturnTo('?returnTo=%2Ffan%2Flogin'), {
        portal: 'fan',
        fallbackRoute: '/fan',
      })
    ).toBe('/fan');

    expect(
      toSafeReturnTo(getRequestedReturnTo('?returnTo=%2Fpartner%2Fadmin'), {
        portal: 'partner',
        fallbackRoute: '/partner',
      })
    ).toBe('/partner/admin');

    expect(
      toSafeReturnTo(getRequestedReturnTo('?returnTo=%2Ffan%2Forders'), {
        portal: 'partner',
        fallbackRoute: '/partner',
      })
    ).toBe('/partner');
  });

  test('portal issue matrix preserves cross-portal guidance', async () => {
    const mismatchCases = [
      {
        code: 'auth_portal_mismatch_fan_to_partner',
        currentPortal: 'fan' as const,
        returnTo: '/fan/orders',
        expectedRedirect: '/partner/login?returnTo=%2Ffan%2Forders',
        expectedMessage: /partner portal/i,
      },
      {
        code: 'auth_portal_mismatch_partner_to_fan',
        currentPortal: 'partner' as const,
        returnTo: '/partner/admin',
        expectedRedirect: '/fan/login?returnTo=%2Fpartner%2Fadmin',
        expectedMessage: /fan portal/i,
      },
      {
        code: 'auth_oidc_failed',
        currentPortal: 'fan' as const,
        returnTo: '/fan',
        expectedRedirect: null,
        expectedMessage: /google login failed/i,
      },
    ];

    for (const scenario of mismatchCases) {
      const issue = resolvePortalIssue(scenario);
      expect(issue.code).toBe(scenario.code);
      expect(issue.redirectTo).toBe(scenario.expectedRedirect);
      expect(issue.message || '').toMatch(scenario.expectedMessage);
    }

    const searchIssue = resolvePortalIssueFromSearch({
      search: '?error=auth_portal_mismatch_partner_to_fan&returnTo=%2Fpartner%2Fadmin',
      currentPortal: 'partner',
      fallbackReturnTo: '/partner',
    });
    expect(searchIssue.redirectTo).toBe('/fan/login?returnTo=%2Fpartner%2Fadmin');
  });

  test('public route chrome matrix exposes the shared public shell and callback exception', async ({
    page,
  }) => {
    for (const routePath of PUBLIC_ROUTES_WITH_CHROME) {
      await test.step(routePath, async () => {
        await page.goto(`${UI_BASE_URL}${routePath}`, { waitUntil: 'domcontentloaded' });
        await expect(page.locator('header').first()).toBeVisible();
        await expect(page.locator('footer').first()).toBeVisible();
      });
    }

    await page.goto(
      `${UI_BASE_URL}/auth/oidc/callback?portal=fan&error=auth_oidc_failed&message=${encodeURIComponent('OIDC callback test')}`,
      { waitUntil: 'domcontentloaded' }
    );
    await expect(page.locator('footer')).toHaveCount(0);
  });

  test('partner admin access matrix enforces portal and role boundaries', async ({ page }) => {
    const accessCases = [
      {
        label: 'public user is redirected to partner login',
        exercise: async () => {
          await gotoApp(page, '/partner/admin', { waitUntil: 'domcontentloaded', authRetry: false });
        },
        assert: async () => {
          await expectRedirectToPortalLogin(page, '/partner/admin');
        },
      },
      {
        label: 'buyer is blocked from admin area',
        exercise: async () => {
          await loginBuyer(page);
          await gotoApp(page, '/partner/admin', { waitUntil: 'domcontentloaded', authRetry: false });
        },
        assert: async () => {
          await expect(page).toHaveURL(/\/forbidden(?:[/?#]|$)/i, { timeout: 15000 });
          await expect(page.getByRole('heading', { name: /forbidden/i })).toBeVisible({ timeout: 15000 });
        },
      },
      {
        label: 'artist is blocked from admin area',
        exercise: async () => {
          await loginArtist(page);
          await gotoApp(page, '/partner/admin', { waitUntil: 'domcontentloaded', authRetry: false });
        },
        assert: async () => {
          await expect(page).toHaveURL(/\/forbidden(?:[/?#]|$)/i, { timeout: 15000 });
          await expect(page.getByRole('heading', { name: /forbidden/i })).toBeVisible({ timeout: 15000 });
        },
      },
      {
        label: 'label is blocked from admin area',
        exercise: async () => {
          await loginLabel(page);
          await gotoApp(page, '/partner/admin', { waitUntil: 'domcontentloaded', authRetry: false });
        },
        assert: async () => {
          await expect(page).toHaveURL(/\/forbidden(?:[/?#]|$)/i, { timeout: 15000 });
          await expect(page.getByRole('heading', { name: /forbidden/i })).toBeVisible({ timeout: 15000 });
        },
      },
      {
        label: 'admin reaches canonical admin dashboard',
        exercise: async () => {
          await loginAdmin(page);
          await gotoApp(page, '/partner/admin', { waitUntil: 'domcontentloaded', authRetry: false });
        },
        assert: async () => {
          await expect(page).toHaveURL(/\/partner\/admin(?:[/?#]|$)/i, { timeout: 15000 });
          await expect(page.getByRole('heading', { name: /admin dashboard/i })).toBeVisible({
            timeout: 15000,
          });
        },
      },
    ];

    for (const scenario of accessCases) {
      await test.step(scenario.label, async () => {
        await scenario.exercise();
        await scenario.assert();
      });
    }
  });

  test('fan portal rejects partner credentials and preserves partner login redirect', async ({
    page,
  }) => {
    test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, 'Missing admin credentials');

    await loginFanWithCredentials(page, ADMIN_EMAIL, ADMIN_PASSWORD, { expectRejection: true });
    await expect(page).not.toHaveURL(/\/partner\/(admin|artist|label)/, { timeout: 15000 });
    await expect(page).toHaveURL(/\/fan\/login/, { timeout: 15000 });

    const mismatchSignals = [
      page.getByText(/this account is for the partner portal|partner portal/i).first(),
      page.getByRole('link', { name: /partner login|go to partner login/i }).first(),
      page.getByRole('button', { name: /partner login|go to partner login/i }).first(),
      page.getByText(/role_not_allowed|not allowed|unauthorized|forbidden/i).first(),
    ];

    await expect
      .poll(
        async () => {
          for (const signal of mismatchSignals) {
            if (await signal.isVisible().catch(() => false)) return true;
          }
          return false;
        },
        { timeout: 15000 }
      )
      .toBe(true);

    await gotoApp(page, '/partner/admin', { waitUntil: 'domcontentloaded', authRetry: false });
    await expectRedirectToPortalLogin(page, '/partner/admin');
  });
});
