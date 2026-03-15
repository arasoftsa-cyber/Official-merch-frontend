import React, { useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { apiFetch } from '../../../../shared/api/http';
import {
  clearSession,
  setSession,
} from '../../../../shared/auth/tokenStore';
import { buildGoogleOidcStartUrl } from '../../../../shared/auth/oidc';
import { Page, Card } from '../../../../shared/ui/Page';
import {
  getPortalLoginHref,
  getRequestedReturnTo,
  isPartnerRole,
  resolvePortalIssue,
  resolvePortalIssueFromSearch,
  resolvePostLoginRedirect,
  resolveRoleFromAuthPayload,
  toSafeReturnTo,
} from '../../../../shared/auth/routingPolicy';

export default function PartnerLoginPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const requestedReturnTo = getRequestedReturnTo(location.search);
  const safeReturnTo = toSafeReturnTo(requestedReturnTo, { portal: 'partner', fallbackRoute: '/partner' });
  const portalIssue = resolvePortalIssueFromSearch({
    search: location.search,
    currentPortal: 'partner',
    fallbackReturnTo: safeReturnTo,
  });
  const forgotPasswordTarget = `/forgot-password?portal=partner&returnTo=${encodeURIComponent(safeReturnTo)}`;
  const fanLinkTarget = getPortalLoginHref('fan', safeReturnTo);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isGoogleRedirecting, setIsGoogleRedirecting] = useState(false);
  const emailRef = useRef<HTMLInputElement | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const loginResponse = await apiFetch('/auth/partner/login', {
        method: 'POST',
        body: { email, password },
      } as any);

      const accessToken =
        loginResponse?.accessToken ||
        loginResponse?.token ||
        loginResponse?.data?.accessToken ||
        loginResponse?.access_token ||
        null;
      const refreshToken =
        loginResponse?.refreshToken ||
        loginResponse?.data?.refreshToken ||
        loginResponse?.refresh_token ||
        null;

      if (!accessToken) {
        throw new Error('Missing access token');
      }

      setSession({
        accessToken,
        refreshToken,
      });

      const me = await apiFetch('/auth/whoami');
      const role = resolveRoleFromAuthPayload(me);
      if (!isPartnerRole(role)) {
        clearSession();
        const issue = resolvePortalIssue({
          code: 'auth_portal_mismatch_partner_to_fan',
          currentPortal: 'partner',
          returnTo: safeReturnTo,
        });
        if (issue.redirectTo) {
          navigate(issue.redirectTo, { replace: true });
          return;
        }
        setError(issue.message || 'Login failed');
        return;
      }

      const target = resolvePostLoginRedirect({
        search: location.search,
        portal: 'partner',
        role,
        fallbackRoute: '/',
      });
      navigate(target, { replace: true });
    } catch (err: any) {
      const issue = resolvePortalIssue({
        code: err?.payload?.error || err?.message,
        message: err?.payload?.message,
        currentPortal: 'partner',
        returnTo: safeReturnTo,
      });
      if (issue.redirectTo) {
        clearSession();
        navigate(issue.redirectTo, { replace: true });
        return;
      }
      setError(issue.message || err?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleContinue = () => {
    if (loading || isGoogleRedirecting) return;
    setIsGoogleRedirecting(true);
    const target = buildGoogleOidcStartUrl('partner', safeReturnTo);
    window.location.assign(target);
  };

  return (
    <Page className="flex min-h-screen flex-col items-center justify-center bg-white dark:bg-[#0a0a0a] px-4 py-12 text-slate-900 dark:text-white">
      <div className="w-full max-w-[440px]">
        <Card className="flex flex-col items-center rounded-[40px] border border-slate-200 bg-white p-10 shadow-2xl dark:border-white/10 dark:bg-[#141414] dark:shadow-none">
          <div className="mb-8 flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 dark:border-white/10 dark:bg-white/5">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-[10px] font-bold text-white dark:bg-white dark:text-black">
              OM
            </div>
            <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-600 dark:text-white/80">
              OFFICIALMERCH
            </span>
          </div>

          <div className="mb-10 text-center">
            <h1 className="text-4xl font-bold tracking-tight text-slate-900 dark:text-white">
              Partner login
            </h1>
            <p className="mt-4 text-sm text-slate-500 dark:text-white/60">
              Use your partner credentials to access dashboards.
            </p>
          </div>

          {portalIssue.message && (
            <div role="alert" aria-live="polite" className="mb-6 w-full rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs font-medium text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/5 dark:text-amber-400">
              {portalIssue.message}
            </div>
          )}

          {error && (
            <div role="alert" aria-live="polite" className="mb-6 w-full rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-medium text-rose-600 dark:border-rose-500/20 dark:bg-rose-500/5 dark:text-rose-400">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="w-full space-y-6">
            <div className="space-y-2">
              <label
                htmlFor="email"
                className="px-1 text-sm font-medium text-slate-500 dark:text-white/40"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                ref={emailRef}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                aria-invalid={Boolean(error)}
                className="h-14 w-full rounded-2xl border border-slate-200 bg-slate-50 px-5 text-base text-slate-900 outline-none transition focus:border-slate-900 dark:border-white/10 dark:bg-white/[0.03] dark:text-white dark:focus:border-white/30"
                placeholder="you@example.com"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <label
                  htmlFor="password"
                  className="text-sm font-medium text-slate-500 dark:text-white/40"
                >
                  Password
                </label>
                <Link
                  data-testid="partner-login-forgot-password"
                  to={forgotPasswordTarget}
                  className="text-[10px] font-bold uppercase tracking-widest text-slate-400 transition hover:text-slate-900 dark:text-white/30 dark:hover:text-white"
                >
                  Forgot?
                </Link>
              </div>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  aria-invalid={Boolean(error)}
                  className="h-14 w-full rounded-2xl border border-slate-200 bg-slate-50 px-5 pr-20 text-base text-slate-900 outline-none transition focus:border-slate-900 dark:border-white/10 dark:bg-white/[0.03] dark:text-white dark:focus:border-white/30"
                  placeholder="********"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full border border-slate-200 bg-slate-100 px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-500 transition hover:bg-slate-200 hover:text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-white/40 dark:hover:bg-white/10 dark:hover:text-white"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || isGoogleRedirecting}
              className="h-14 w-full rounded-2xl bg-slate-900 text-base font-bold text-white transition hover:bg-slate-800 disabled:opacity-50 dark:bg-[#9c9c9c] dark:text-black dark:hover:bg-[#b0b0b0]"
            >
              {loading ? 'Authenticating...' : 'Login'}
            </button>

            <button
              data-testid="partner-login-google"
              type="button"
              onClick={handleGoogleContinue}
              disabled={loading || isGoogleRedirecting}
              className="h-14 w-full rounded-2xl border border-slate-300 bg-white text-base font-semibold text-slate-900 transition hover:bg-slate-100 disabled:opacity-50 dark:border-white/20 dark:bg-white/[0.03] dark:text-white dark:hover:bg-white/[0.08]"
            >
              {isGoogleRedirecting ? 'Redirecting to Google...' : 'Continue with Google'}
            </button>
          </form>

          <div className="mt-8 text-center text-sm text-slate-500 dark:text-white/40">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-white/50">
              For approved partner/admin accounts only
            </p>
            Fan login?{' '}
            <Link
              to={fanLinkTarget}
              className="font-semibold text-slate-900 underline underline-offset-4 dark:text-white"
            >
              Click here
            </Link>
            .
          </div>
        </Card>
      </div>
    </Page>
  );
}
