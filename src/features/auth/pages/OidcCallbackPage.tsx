import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { apiFetch } from '../../../shared/api/http';
import {
  clearTokens,
  getAccessToken,
  setAccessToken,
  setRefreshToken,
} from '../../../shared/auth/tokenStore';
import { toSafeReturnTo } from '../../../shared/auth/oidc';
import { Page, Card } from '../../../shared/ui/Page';

type Portal = 'fan' | 'partner';

const parsePortal = (value: string | null): Portal => (value === 'partner' ? 'partner' : 'fan');

const exchangedCodes = new Set<string>();
const exchangeRequests = new Map<string, Promise<any>>();

const exchangeCodeOnce = (code: string): Promise<any | null> => {
  const normalizedCode = String(code || '').trim();
  if (!normalizedCode) return Promise.resolve(null);

  if (exchangedCodes.has(normalizedCode)) {
    return Promise.resolve(null);
  }

  const inFlight = exchangeRequests.get(normalizedCode);
  if (inFlight) return inFlight;

  const requestPromise = apiFetch('/auth/oidc/google/exchange', {
    method: 'POST',
    body: { code: normalizedCode },
  })
    .then((payload: any) => {
      exchangedCodes.add(normalizedCode);
      return payload;
    })
    .finally(() => {
      exchangeRequests.delete(normalizedCode);
    });

  exchangeRequests.set(normalizedCode, requestPromise);
  return requestPromise;
};

export default function OidcCallbackPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const portal = parsePortal(params.get('portal'));
  const returnTo = toSafeReturnTo(params.get('returnTo'), portal);
  const code = String(params.get('code') || '').trim();
  const portalError = String(params.get('portalError') || '').trim();
  const portalMessage = String(params.get('message') || '').trim();
  const loginTarget = `${portal === 'partner' ? '/partner/login' : '/fan/login'}?returnTo=${encodeURIComponent(returnTo)}`;

  useEffect(() => {
    let cancelled = false;

    if (portalError) {
      setError(portalMessage || 'Google sign-in failed.');
      return () => {
        cancelled = true;
      };
    }

    if (!code) {
      setError('Missing Google sign-in code.');
      return () => {
        cancelled = true;
      };
    }

    (async () => {
      try {
        const payload: any = await exchangeCodeOnce(code);
        if (payload === null) {
          if (!cancelled && getAccessToken()) {
            navigate(returnTo, { replace: true });
            return;
          }
          throw new Error('OIDC callback code already processed.');
        }

        if (cancelled) return;

        const accessToken =
          payload?.accessToken ||
          payload?.token ||
          payload?.data?.accessToken ||
          payload?.access_token ||
          '';
        const refreshToken =
          payload?.refreshToken ||
          payload?.data?.refreshToken ||
          payload?.refresh_token ||
          '';

        if (!accessToken) {
          throw new Error('Google login response did not include an access token.');
        }

        setAccessToken(accessToken);
        if (refreshToken) {
          setRefreshToken(refreshToken);
        }

        if (cancelled) return;
        navigate(returnTo, { replace: true });
      } catch (err: any) {
        const errCode = String(err?.payload?.error || '').trim().toLowerCase();
        if (errCode === 'invalid_exchange_code' && getAccessToken()) {
          if (!cancelled) {
            navigate(returnTo, { replace: true });
          }
          return;
        }
        clearTokens();
        if (cancelled) return;
        setError(String(err?.message || 'Google sign-in failed.'));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [code, navigate, portalError, portalMessage, returnTo]);

  return (
    <Page className="flex min-h-screen flex-col items-center justify-center bg-white dark:bg-[#0a0a0a] px-4 py-12 text-slate-900 dark:text-white">
      <div className="w-full max-w-[440px]">
        <Card className="flex flex-col items-center rounded-[40px] border border-slate-200 bg-white p-10 shadow-2xl dark:border-white/10 dark:bg-[#141414] dark:shadow-none">
          {!error ? (
            <div className="text-center">
              <h1 className="text-2xl font-bold" data-testid="oidc-callback-loading">
                Completing Google sign-in...
              </h1>
              <p className="mt-3 text-sm text-slate-500 dark:text-white/60">
                Please wait while we finish your authentication.
              </p>
            </div>
          ) : (
            <div className="w-full text-center">
              <div
                role="alert"
                data-testid="oidc-callback-error"
                className="rounded-2xl border border-rose-300/70 bg-rose-50 p-4 text-sm font-medium text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
              >
                {error}
              </div>
              <Link
                to={loginTarget}
                className="mt-5 inline-block text-sm font-semibold text-slate-900 underline underline-offset-4 dark:text-white"
              >
                Back to login
              </Link>
            </div>
          )}
        </Card>
      </div>
    </Page>
  );
}
