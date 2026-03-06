import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { apiPost } from '../../lib/api';
import { setAccessToken } from '../../shared/auth/tokenStore';
import { Page, Card } from '../../ui/Page';

export default function FanRegisterPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const rawReturn = params.get('returnTo') || params.get('next') || '/fan';
  let redirectTarget = rawReturn;
  try {
    redirectTarget = decodeURIComponent(rawReturn);
  } catch {
    redirectTarget = rawReturn;
  }
  const safeRedirectTarget =
    redirectTarget.startsWith('/') && !redirectTarget.startsWith('//') ? redirectTarget : '/fan';
  const loginLinkTarget = `/fan/login?returnTo=${encodeURIComponent(safeRedirectTarget)}`;
  const partnerLinkTarget = `/partner/login?returnTo=${encodeURIComponent(safeRedirectTarget)}`;
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const res: any = await apiPost('/auth/register', {
        name,
        email,
        password,
        role: 'buyer',
      });

      const token = res?.accessToken || res?.token;
      if (token) {
        setAccessToken(token);
        navigate(safeRedirectTarget);
      } else {
        // Backup: navigate to login if registration succeeded but didn't auto-login
        navigate(`/fan/login?returnTo=${encodeURIComponent(safeRedirectTarget)}`);
      }
    } catch (err: any) {
      setError(err?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Page className="flex min-h-screen flex-col items-center justify-center bg-white dark:bg-[#0a0a0a] px-4 py-12 text-slate-900 dark:text-white">
      <div className="w-full max-w-[440px]">
        <Card className="flex flex-col items-center rounded-[40px] border border-slate-200 bg-white p-10 shadow-2xl dark:border-white/10 dark:bg-[#141414] dark:shadow-none">
          {/* Badge */}
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
              Create Account
            </h1>
            <p className="mt-4 text-sm text-slate-500 dark:text-white/60">
              Join the OfficialMerch community.
            </p>
          </div>

          {error && (
            <div className="mb-6 w-full rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-medium text-rose-600 dark:border-rose-500/20 dark:bg-rose-500/5 dark:text-rose-400">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="w-full space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="name"
                className="px-1 text-sm font-medium text-slate-500 dark:text-white/40"
              >
                Full Name
              </label>
              <input
                id="name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-5 text-base text-slate-900 outline-none transition focus:border-slate-900 dark:border-white/10 dark:bg-white/[0.03] dark:text-white dark:focus:border-white/30"
                placeholder="John Doe"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="email"
                className="px-1 text-sm font-medium text-slate-500 dark:text-white/40"
              >
                Email Address
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-5 text-base text-slate-900 outline-none transition focus:border-slate-900 dark:border-white/10 dark:bg-white/[0.03] dark:text-white dark:focus:border-white/30"
                placeholder="name@example.com"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="password"
                className="px-1 text-sm font-medium text-slate-500 dark:text-white/40"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-5 text-base text-slate-900 outline-none transition focus:border-slate-900 dark:border-white/10 dark:bg-white/[0.03] dark:text-white dark:focus:border-white/30"
                placeholder="••••••••"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="confirmPassword"
                className="px-1 text-sm font-medium text-slate-500 dark:text-white/40"
              >
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-5 text-base text-slate-900 outline-none transition focus:border-slate-900 dark:border-white/10 dark:bg-white/[0.03] dark:text-white dark:focus:border-white/30"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-6 h-14 w-full rounded-2xl bg-slate-900 text-base font-bold text-white transition hover:bg-slate-800 disabled:opacity-50 dark:bg-[#9c9c9c] dark:text-black dark:hover:bg-[#b0b0b0]"
            >
              {loading ? 'Creating Account...' : 'Sign Up'}
            </button>
          </form>

          <div className="mt-8 flex flex-col items-center gap-2 text-sm text-slate-500 dark:text-white/40">
            <p>
              Already have an account?{' '}
              <Link
                to={`/fan/login?returnTo=${encodeURIComponent(safeRedirectTarget)}`}
                className="font-semibold text-slate-900 underline underline-offset-4 dark:text-white"
              >
                Login
              </Link>
            </p>
            <p>
              Are you an artist?{' '}
              <Link
                to={`/partner/login?returnTo=${encodeURIComponent(safeRedirectTarget)}`}
                className="font-semibold text-slate-900 underline underline-offset-4 dark:text-white"
              >
                Partner Portal
              </Link>
            </p>
          </div>
        </Card>
      </div>
    </Page>
  );
}
