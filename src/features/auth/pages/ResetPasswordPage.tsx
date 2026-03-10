import React, { useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { resetPassword } from '../../../shared/api/auth';
import { Page, Card } from '../../../shared/ui/Page';

const getPasswordError = (value: string): string | null => {
  if (!value) return 'Password is required';
  if (value.length < 12) return 'Password must be at least 12 characters';
  if (!/[A-Z]/.test(value)) return 'Password must include an uppercase letter';
  if (!/[a-z]/.test(value)) return 'Password must include a lowercase letter';
  if (!/[0-9]/.test(value)) return 'Password must include a number';
  if (!/[^A-Za-z0-9]/.test(value)) return 'Password must include a special character';
  return null;
};

export default function ResetPasswordPage() {
  const location = useLocation();
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const token = String(params.get('token') || '').trim();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting || success) return;
    setError(null);

    if (!token) {
      setError('Reset token is missing or invalid.');
      return;
    }

    const passwordError = getPasswordError(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      await resetPassword(token, password);
      setSuccess(true);
    } catch (err: any) {
      const apiError = String(err?.payload?.error || '').trim().toLowerCase();
      if (apiError === 'invalid_or_expired_token') {
        setError('This reset link is invalid or has expired. Request a new one.');
      } else {
        setError(err?.message || 'Failed to reset password');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Page className="flex min-h-screen flex-col items-center justify-center bg-white dark:bg-[#0a0a0a] px-4 py-12 text-slate-900 dark:text-white">
      <div className="w-full max-w-[440px]">
        <Card className="flex flex-col rounded-[40px] border border-slate-200 bg-white p-10 shadow-2xl dark:border-white/10 dark:bg-[#141414] dark:shadow-none">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            Reset password
          </h1>
          <p className="mt-3 text-sm text-slate-500 dark:text-white/60">
            Enter a new password for your account.
          </p>

          {success ? (
            <div className="mt-8 rounded-2xl border border-emerald-300/70 bg-emerald-50 p-4 text-sm font-medium text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
              Password updated successfully. You can now sign in with your new password.
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
                <label htmlFor="password" className="px-1 text-sm font-medium text-slate-500 dark:text-white/40">
                  New password
                </label>
                <input
                  id="password"
                  data-testid="reset-password-new"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="new-password"
                  required
                  className="h-14 w-full rounded-2xl border border-slate-200 bg-slate-50 px-5 text-base text-slate-900 outline-none transition focus:border-slate-900 dark:border-white/10 dark:bg-white/[0.03] dark:text-white dark:focus:border-white/30"
                  placeholder="********"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="confirmPassword" className="px-1 text-sm font-medium text-slate-500 dark:text-white/40">
                  Confirm password
                </label>
                <input
                  id="confirmPassword"
                  data-testid="reset-password-confirm"
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  autoComplete="new-password"
                  required
                  className="h-14 w-full rounded-2xl border border-slate-200 bg-slate-50 px-5 text-base text-slate-900 outline-none transition focus:border-slate-900 dark:border-white/10 dark:bg-white/[0.03] dark:text-white dark:focus:border-white/30"
                  placeholder="********"
                />
              </div>

              <button
                data-testid="reset-password-submit"
                type="submit"
                disabled={submitting}
                className="h-14 w-full rounded-2xl bg-slate-900 text-base font-bold text-white transition hover:bg-slate-800 disabled:opacity-50 dark:bg-[#9c9c9c] dark:text-black dark:hover:bg-[#b0b0b0]"
              >
                {submitting ? 'Updating password...' : 'Update password'}
              </button>
            </form>
          )}

          <Link
            to="/fan/login"
            className="mt-8 inline-block text-sm font-semibold text-slate-900 underline underline-offset-4 dark:text-white"
          >
            Back to login
          </Link>
        </Card>
      </div>
    </Page>
  );
}

