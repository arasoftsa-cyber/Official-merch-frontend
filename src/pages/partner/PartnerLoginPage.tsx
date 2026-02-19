import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Label from '../../components/ui/Label';
import {
  setAccessToken,
  setRefreshToken,
  clearTokens,
} from '../../shared/auth/tokenStore';
import { apiFetch } from '../../shared/api/http';
const LOGIN_CONTEXT_KEY = 'om_login_context';
const PARTNER_ALLOWED_ROLES = new Set(['artist', 'label', 'admin']);

function resolveRole(payload: any): string {
  const role =
    payload?.role ||
    (Array.isArray(payload?.roles) ? payload.roles[0] : null) ||
    payload?.user?.role ||
    null;
  return String(role || '').toLowerCase();
}

export default function PartnerLoginPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const portalError = params.get('portalError');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const emailRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    localStorage.setItem(LOGIN_CONTEXT_KEY, 'partner');
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    localStorage.setItem(LOGIN_CONTEXT_KEY, 'partner');
    try {
      const loginResponse = await apiFetch('/auth/login', {
        method: 'POST',
        body: { email, password },
      });

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

      setAccessToken(accessToken);
      if (refreshToken) {
        setRefreshToken(refreshToken);
      }

      const me = await apiFetch('/auth/whoami');
      const role = resolveRole(me);
      if (!PARTNER_ALLOWED_ROLES.has(role)) {
        clearTokens();
        localStorage.removeItem(LOGIN_CONTEXT_KEY);
        navigate('/fan/login?portalError=fan_account', { replace: true });
        return;
      }

      // Redirect resolution is centralized in App loginEntryElement.
      navigate(`/login${location.search}`, { replace: true });
    } catch (err: any) {
      setError(err?.message ?? 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
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
          <h1 className="text-3xl font-semibold tracking-tight text-white">Partner login</h1>
          <p className="mt-2 text-sm text-white/70">Use your partner credentials to access dashboards.</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5 mt-8">
          <div className="space-y-2">
            <Label htmlFor="partner-email" className="text-sm text-white/60">
              Email
            </Label>
            <Input
              id="partner-email"
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
          <div className="space-y-2 relative">
            <Label htmlFor="partner-password" className="text-sm text-white/60">
              Password
            </Label>
            <Input
              id="partner-password"
              type={showPassword ? 'text' : 'password'}
              name="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              placeholder="••••••••"
              data-testid="login-password"
              className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 pr-16 outline-none transition focus:ring-2 focus:ring-white/20 placeholder:text-slate-400"
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/5 px-3 py-1 text-[0.55rem] font-semibold uppercase tracking-[0.45em] text-slate-300/80 transition duration-150 hover:bg-white/15 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-pressed={showPassword}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
          <div className="min-h-[2.5rem]">
            {portalError === 'partner_account' && (
              <div role="alert" className="mb-3 rounded-xl bg-amber-500/10 border border-amber-500/30 px-4 py-3 text-sm text-amber-100">
                This account is a partner/admin account. Please log in via Partner portal.
              </div>
            )}
            {portalError === 'fan_account' && (
              <div role="alert" className="mb-3 rounded-xl bg-amber-500/10 border border-amber-500/30 px-4 py-3 text-sm text-amber-100">
                This is a fan account. Please log in via Fan portal.
              </div>
            )}
            {error && (
              <div role="alert" className="rounded-xl bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-200">
                {error}
              </div>
            )}
          </div>
          <button
            type="submit"
            disabled={loading || !email || !password}
            aria-busy={loading}
            data-testid="login-submit"
            className="mt-2 w-full rounded-2xl bg-white/95 text-black py-3 font-medium transition hover:bg-white active:opacity-90 disabled:opacity-60"
          >
            Login
          </button>
        </form>
        <p className="text-xs text-center text-slate-400 mt-4">
          Fan login? <Link className="underline" to="/fan/login">Click here</Link>.
        </p>
      </Card>
    </div>
  );
}
