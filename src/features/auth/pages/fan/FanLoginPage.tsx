import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Card from '../../../../shared/ui/legacy/Card';
import { apiFetch } from '../../../../shared/api/http';
import { clearTokens, setAccessToken, setRefreshToken } from '../../../../shared/auth/tokenStore';
import { buildGoogleOidcStartUrl } from '../../../../shared/auth/oidc';

const FAN_ALLOWED_ROLES = new Set(['buyer', 'fan', 'customer']);
const ROLE_NOT_ALLOWED_MESSAGE = 'This account is for the Partner Portal. Go to Partner Login';

function resolveRole(payload: any): string {
  const role =
    payload?.role ||
    (Array.isArray(payload?.roles) ? payload.roles[0] : null) ||
    payload?.user?.role ||
    null;
  return String(role || '').toLowerCase();
}

function toSafeReturnTo(raw: string | null): string {
  const value = String(raw || '').trim();
  if (!value) return '/fan';
  try {
    const decoded = decodeURIComponent(value);
    if (decoded.startsWith('/') && !decoded.startsWith('//')) return decoded;
  } catch {
    // ignore malformed returnTo
  }
  return '/fan';
}

export default function FanLoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = new URLSearchParams(location.search).get('returnTo') ?? '/fan';
  const safeReturnTo = toSafeReturnTo(returnTo);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [partnerRedirect, setPartnerRedirect] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleRedirecting, setIsGoogleRedirecting] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const portalError = String(params.get('portalError') || '').trim();
    const message = String(params.get('message') || '').trim();

    if (!portalError && !message) return;

    if (portalError === 'partner_account') {
      setError(message || ROLE_NOT_ALLOWED_MESSAGE);
      setPartnerRedirect('/partner/login');
      return;
    }

    if (message) {
      setError(message);
    }
  }, [location.search]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    setError(null);
    setPartnerRedirect(null);

    try {
      const res: any = await apiFetch('/auth/fan/login', {
        method: 'POST',
        body: { email, password },
      });
      const role = resolveRole(res);
      if (role && !FAN_ALLOWED_ROLES.has(role)) {
        clearTokens();
        setError(ROLE_NOT_ALLOWED_MESSAGE);
        setPartnerRedirect('/partner/login');
        return;
      }

      const accessToken = res?.accessToken || res?.token || '';
      const refreshToken = res?.refreshToken || '';
      if (accessToken) {
        setAccessToken(accessToken);
      }
      if (refreshToken) {
        setRefreshToken(refreshToken);
      }

      navigate(safeReturnTo, { replace: true });
    } catch (err: any) {
      const status = Number(err?.status || 0);
      const body = err?.payload || null;
      if (status === 403 && body?.error === 'ROLE_NOT_ALLOWED') {
        clearTokens();
        setError(ROLE_NOT_ALLOWED_MESSAGE);
        setPartnerRedirect(String(body?.redirectTo || '/partner/login'));
      } else {
        setError(err?.message || 'Login failed');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleContinue = () => {
    if (isGoogleRedirecting) return;
    setIsGoogleRedirecting(true);
    const target = buildGoogleOidcStartUrl('fan', safeReturnTo);
    window.location.assign(target);
  };

  return (
    <div className="relative min-h-screen bg-neutral-950 text-neutral-100 flex items-center justify-center px-4 overflow-hidden">
      <div className="pointer-events-none absolute inset-0 opacity-30">
        <div className="absolute -left-16 top-1/4 h-64 w-64 blur-[120px] bg-gradient-to-br from-amber-500/20 via-transparent to-transparent" />
        <div className="absolute right-0 bottom-0 h-64 w-64 blur-[160px] bg-gradient-to-br from-purple-600/20 via-transparent to-transparent" />
      </div>
      <Card className="relative z-10 w-full max-w-md rounded-3xl border border-white/10 bg-white/[0.06] p-10 shadow-2xl backdrop-blur">
        <div className="mb-10 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 dark:text-white">Fan login</h1>
          <p className="mt-4 text-sm text-slate-500 dark:text-white/60">
            Welcome back. Access your orders and favorites.
          </p>
        </div>

        {error && (
          <div
            role="alert"
            aria-live="polite"
            data-testid={partnerRedirect ? 'fan-login-role-not-allowed' : undefined}
            className="mb-6 w-full rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-medium text-rose-600 dark:border-rose-500/20 dark:bg-rose-500/5 dark:text-rose-400"
          >
            <p>{error}</p>
            {partnerRedirect && (
              <Link
                data-testid="fan-login-partner-link"
                to={`${partnerRedirect}?returnTo=${encodeURIComponent(safeReturnTo)}`}
                className="mt-2 inline-block font-semibold underline underline-offset-4"
              >
                Go to Partner Login
              </Link>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="w-full space-y-6">
          <div className="space-y-2">
            <label htmlFor="email" className="px-1 text-sm font-medium text-slate-500 dark:text-white/40">
              Email
            </label>
            <input
              id="email"
              data-testid="fan-login-email"
              type="email"
              name="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              aria-invalid={Boolean(error)}
              className="h-14 w-full rounded-2xl border border-slate-200 bg-slate-50 px-5 text-base text-slate-900 outline-none transition focus:border-slate-900 dark:border-white/10 dark:bg-white/[0.03] dark:text-white dark:focus:border-white/30"
              placeholder="you@example.com"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <label htmlFor="password" className="text-sm font-medium text-slate-500 dark:text-white/40">
                Password
              </label>
              <Link
                data-testid="fan-login-forgot-password"
                to={`/forgot-password?portal=fan&returnTo=${encodeURIComponent(safeReturnTo)}`}
                className="text-[10px] font-bold uppercase tracking-widest text-slate-400 transition hover:text-slate-900 dark:text-white/30 dark:hover:text-white"
              >
                Forgot?
              </Link>
            </div>
            <div className="relative">
              <input
                id="password"
                data-testid="fan-login-password"
                type={showPassword ? 'text' : 'password'}
                name="password"
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
            data-testid="fan-login-submit"
            type="submit"
            disabled={isSubmitting || isGoogleRedirecting}
            className="h-14 w-full rounded-2xl bg-slate-900 text-base font-bold text-white transition hover:bg-slate-800 disabled:opacity-50 dark:bg-[#9c9c9c] dark:text-black dark:hover:bg-[#b0b0b0]"
          >
            {isSubmitting ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>

        <div className="mt-6">
          <button
            data-testid="fan-login-google"
            type="button"
            onClick={handleGoogleContinue}
            disabled={isSubmitting || isGoogleRedirecting}
            className="h-14 w-full rounded-2xl border border-slate-300 bg-white text-base font-semibold text-slate-900 transition hover:bg-slate-100 disabled:opacity-50 dark:border-white/20 dark:bg-white/[0.03] dark:text-white dark:hover:bg-white/[0.08]"
          >
            {isGoogleRedirecting ? 'Redirecting to Google...' : 'Continue with Google'}
          </button>
        </div>

        <div className="mt-8 flex flex-col items-center gap-2 text-sm text-slate-500 dark:text-white/40">
          <p>
            New here?{' '}
            <Link
              to={`/fan/register?returnTo=${encodeURIComponent(safeReturnTo)}`}
              className="font-semibold text-slate-900 underline underline-offset-4 dark:text-white"
            >
              Sign up
            </Link>
          </p>
          <p>
            Are you an artist?{' '}
            <Link
              to={`/partner/login?returnTo=${encodeURIComponent(safeReturnTo)}`}
              className="font-semibold text-slate-900 underline underline-offset-4 dark:text-white"
            >
              Partner Login
            </Link>
          </p>
        </div>
      </Card>
    </div>
  );
}
