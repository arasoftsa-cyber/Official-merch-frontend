import React, { useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { forgotPassword } from '../../../shared/api/auth';
import { Page, Card } from '../../../shared/ui/Page';

type Portal = 'fan' | 'partner';

const parsePortal = (value: string | null): Portal => (value === 'partner' ? 'partner' : 'fan');

const toSafeReturnTo = (value: string | null | undefined, portal: Portal): string => {
  const fallback = portal === 'partner' ? '/partner/dashboard' : '/fan';
  const raw = String(value || '').trim();
  if (!raw) return fallback;

  try {
    const decoded = decodeURIComponent(raw);
    if (decoded.startsWith('/') && !decoded.startsWith('//')) return decoded;
  } catch {
    // ignore malformed returnTo
  }
  return fallback;
};

export default function ForgotPasswordPage() {
  const location = useLocation();
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const portal = parsePortal(params.get('portal'));
  const returnTo = toSafeReturnTo(params.get('returnTo'), portal);
  const loginTarget = `${portal === 'partner' ? '/partner/login' : '/fan/login'}?returnTo=${encodeURIComponent(returnTo)}`;

  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;

    const normalizedEmail = String(email || '').trim().toLowerCase();
    if (!normalizedEmail) {
      setError('Email is required');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await forgotPassword(normalizedEmail);
      setSubmitted(true);
    } catch (err: any) {
      setError(err?.message || 'Failed to send password reset email');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Page className="flex min-h-screen flex-col items-center justify-center bg-white dark:bg-[#0a0a0a] px-4 py-12 text-slate-900 dark:text-white">
      <div className="w-full max-w-[440px]">
        <Card className="flex flex-col rounded-[40px] border border-slate-200 bg-white p-10 shadow-2xl dark:border-white/10 dark:bg-[#141414] dark:shadow-none">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            Forgot password
          </h1>
          <p className="mt-3 text-sm text-slate-500 dark:text-white/60">
            Enter your account email and we will send a reset link.
          </p>

          {submitted ? (
            <div className="mt-8 rounded-2xl border border-emerald-300/70 bg-emerald-50 p-4 text-sm font-medium text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
              If an account exists for that email, a reset link has been sent.
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              {error && (
                <div
                  role="alert"
                  className="rounded-2xl border border-rose-300/70 bg-rose-50 p-4 text-sm font-medium text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
                >
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <label htmlFor="email" className="px-1 text-sm font-medium text-slate-500 dark:text-white/40">
                  Email
                </label>
                <input
                  id="email"
                  data-testid="forgot-password-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  required
                  className="h-14 w-full rounded-2xl border border-slate-200 bg-slate-50 px-5 text-base text-slate-900 outline-none transition focus:border-slate-900 dark:border-white/10 dark:bg-white/[0.03] dark:text-white dark:focus:border-white/30"
                  placeholder="you@example.com"
                />
              </div>

              <button
                data-testid="forgot-password-submit"
                type="submit"
                disabled={submitting}
                className="h-14 w-full rounded-2xl bg-slate-900 text-base font-bold text-white transition hover:bg-slate-800 disabled:opacity-50 dark:bg-[#9c9c9c] dark:text-black dark:hover:bg-[#b0b0b0]"
              >
                {submitting ? 'Sending reset link...' : 'Send reset link'}
              </button>
            </form>
          )}

          <Link
            to={loginTarget}
            className="mt-8 inline-block text-sm font-semibold text-slate-900 underline underline-offset-4 dark:text-white"
          >
            Back to login
          </Link>
        </Card>
      </div>
    </Page>
  );
}

