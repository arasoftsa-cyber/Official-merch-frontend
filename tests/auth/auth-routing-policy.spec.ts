import { expect, test } from '@playwright/test';
import {
  resolvePartnerEntryRedirect,
  resolvePortalIssue,
  resolvePostLoginRedirect,
} from '../../src/shared/auth/routingPolicy';

test.describe('Auth routing policy', () => {
  test('fan login resolves to canonical fan route', async () => {
    const target = resolvePostLoginRedirect({
      portal: 'fan',
      role: 'buyer',
      fallbackRoute: '/',
    });
    expect(target).toBe('/fan');
  });

  test('partner login resolves to canonical partner route', async () => {
    const target = resolvePostLoginRedirect({
      portal: 'partner',
      role: 'artist',
      fallbackRoute: '/',
    });
    expect(target).toBe('/partner/artist');
  });

  test('returnTo takes precedence when valid and allowed', async () => {
    const target = resolvePostLoginRedirect({
      portal: 'partner',
      role: 'admin',
      returnTo: '/partner/admin/orders',
      fallbackRoute: '/',
    });
    expect(target).toBe('/partner/admin/orders');
  });

  test('invalid returnTo falls back safely', async () => {
    const target = resolvePostLoginRedirect({
      portal: 'partner',
      role: 'admin',
      returnTo: 'https://evil.example',
      fallbackRoute: '/',
    });
    expect(target).toBe('/partner/admin');
  });

  test('portal mismatch uses shared resolution', async () => {
    const issue = resolvePortalIssue({
      code: 'auth_portal_mismatch_fan_to_partner',
      currentPortal: 'fan',
      returnTo: '/fan/orders',
    });
    expect(issue.code).toBe('auth_portal_mismatch_fan_to_partner');
    expect(issue.redirectTo).toBe('/partner/login?returnTo=%2Ffan%2Forders');
    expect(issue.message).toContain('Partner Portal');
  });

  test('successful auth role resolves to canonical home route without portal context', async () => {
    const target = resolvePostLoginRedirect({
      role: 'admin',
      fallbackRoute: '/',
    });
    expect(target).toBe('/partner/admin');
  });

  test('partner entry fallback avoids redirect loops for non-partner roles', async () => {
    const target = resolvePartnerEntryRedirect('buyer', '/');
    expect(target).toBe('/');
  });
});
