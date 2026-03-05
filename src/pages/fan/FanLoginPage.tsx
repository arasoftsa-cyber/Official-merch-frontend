import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Label from '../../components/ui/Label';
import PublicLayout from '../../shared/layout/PublicLayout';
import { logoutAuth } from '../../lib/api/auth';
import {
  setAccessToken,
  setRefreshToken,
  clearTokens,
} from '../../shared/auth/tokenStore';
import { apiFetch } from '../../shared/api/http';

const LOGIN_CONTEXT_KEY = 'om_login_context';
const FAN_ALLOWED_ROLES = new Set(['buyer', 'fan', 'customer']);
const PARTNER_PORTAL_ERROR_MESSAGE =
  'This is a partner/admin account. Please log in via the partner portal.';

function resolveRole(payload: any): string {
  const role =
    payload?.role ||
    (Array.isArray(payload?.roles) ? payload.roles[0] : null) ||
    payload?.user?.role ||
    null;
  return String(role || '').toLowerCase();
}

export default function FanLoginPage() {
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const portalError = params.get('portalError');
  const rawReturnTo = params.get('returnTo');
  let decodedReturnTo = rawReturnTo || '';
  if (rawReturnTo) {
    try {
      decodedReturnTo = decodeURIComponent(rawReturnTo);
    } catch {
      decodedReturnTo = rawReturnTo;
    }
  }
  const safeReturnTo =
    decodedReturnTo.startsWith('/') && !decodedReturnTo.startsWith('//')
      ? decodedReturnTo
      : null;
  const redirectHint = safeReturnTo || '/';
  const partnerLinkTarget = `/partner/login?returnTo=${encodeURIComponent(
    redirectHint
  )}`;
  const registerLinkTarget = `/fan/register?returnTo=${encodeURIComponent(redirectHint)}`;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res: any = await apiPost('/auth/login', { email, password });

      const token = res?.accessToken || res?.token;
      if (token) {
        setAccessToken(token);
        navigate(returnTo);
      } else {
        setError('Invalid credentials');
      }

      localStorage.removeItem(LOGIN_CONTEXT_KEY);
      navigate(safeReturnTo || '/', { replace: true });
    } catch (err: any) {
      setError(err?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <PublicLayout>
      <div className="relative min-h-screen bg-neutral-950 text-neutral-100 flex items-center justify-center px-4 overflow-hidden">
        <div className="pointer-events-none absolute inset-0 opacity-30">
          <div className="absolute -left-16 top-1/4 h-64 w-64 blur-[120px] bg-gradient-to-br from-amber-500/20 via-transparent to-transparent" />
          <div className="absolute right-0 bottom-0 h-64 w-64 blur-[160px] bg-gradient-to-br from-purple-600/20 via-transparent to-transparent" />
        </div>
        <Card className="relative z-10 w-full max-w-md rounded-3xl border border-white/10 bg-white/[0.06] p-10 shadow-2xl backdrop-blur">
        <div className="space-y-2 text-center">
          <span className="inline-flex items-center justify-center gap-1 rounded-full border border-white/15 bg-white/10 px-3 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.35em] text-slate-200">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-slate-900 text-[0.55rem] font-bold">OM</span>
            OfficialMerch
          </span>
          <h1 className="text-3xl font-semibold tracking-tight text-white">Fan login</h1>
          <p className="mt-2 text-sm text-white/70">Welcome back. Access your orders and favorites.</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5 mt-8">
          <div className="space-y-2">
            <Label htmlFor="fan-email" className="text-sm text-white/60">
              Email
            </Label>
            <Input
              id="fan-email"
              type="email"
              name="email"
              value={email}
              ref={emailRef}
              onChange={(event) => setEmail(event.target.value)}
              autoFocus
              required
              placeholder="you@example.com"
              data-testid="login-email"
              className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 outline-none transition focus:ring-2 focus:ring-white/20 placeholder:text-slate-400"
            />
          </div>

          <div className="mb-10 text-center">
            <h1 className="text-4xl font-bold tracking-tight text-slate-900 dark:text-white">
              Fan login
            </h1>
            <p className="mt-4 text-sm text-slate-500 dark:text-white/60">
              Welcome back. Access your orders and favorites.
            </p>
          </div>

          {error && (
            <div className="mb-6 w-full rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-medium text-rose-600 dark:border-rose-500/20 dark:bg-rose-500/5 dark:text-rose-400">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="w-full space-y-6">
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
                onChange={(e) => setEmail(e.target.value)}
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
                  to="/forgot-password"
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
                  className="h-14 w-full rounded-2xl border border-slate-200 bg-slate-50 px-5 pr-20 text-base text-slate-900 outline-none transition focus:border-slate-900 dark:border-white/10 dark:bg-white/[0.03] dark:text-white dark:focus:border-white/30"
                  placeholder="••••••••"
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
              disabled={loading}
              className="h-14 w-full rounded-2xl bg-slate-900 text-base font-bold text-white transition hover:bg-slate-800 disabled:opacity-50 dark:bg-[#9c9c9c] dark:text-black dark:hover:bg-[#b0b0b0]"
            >
              {loading ? 'Authenticating...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-8 flex flex-col items-center gap-2 text-sm text-slate-500 dark:text-white/40">
            <p>
              New here?{' '}
              <Link
                to={`/fan/register?returnTo=${encodeURIComponent(returnTo)}`}
                className="font-semibold text-slate-900 underline underline-offset-4 dark:text-white"
              >
                Sign up
              </Link>
            </p>
            <p>
              Are you an artist?{' '}
              <Link
                to={`/partner/login?returnTo=${encodeURIComponent(returnTo)}`}
                className="font-semibold text-slate-900 underline underline-offset-4 dark:text-white"
              >
                Partner Login
              </Link>
            </p>
          </div>
          <button
            type="submit"
            disabled={isSubmitting || !email || !password}
            aria-busy={isSubmitting}
            data-testid="login-submit"
            className="mt-2 w-full rounded-2xl bg-white/95 text-black py-3 font-medium transition hover:bg-white active:opacity-90 disabled:opacity-60"
          >
            {isSubmitting ? 'Logging in…' : 'Login'}
          </button>
        </form>
        <div className="text-xs text-center text-slate-400 mt-4 space-y-2">
          <p>
            Need an account? <Link className="underline" to={registerLinkTarget}>Create one</Link>.
          </p>
          <p>
            Partner?{' '}
            <Link className="underline" to={partnerLinkTarget}>
              Login here
            </Link>
            .
          </p>
        </div>
        </Card>
      </div>
    </PublicLayout>
  );
}
