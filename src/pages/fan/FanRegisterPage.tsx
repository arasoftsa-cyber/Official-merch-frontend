import React, { useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { apiPost } from '../../lib/api';
import { setAccessToken } from '../../shared/auth/tokenStore';
import { Page, Card } from '../../ui/Page';

const FIELD_HELPERS = {
  name: 'Enter your full name as you want it shown on your profile.',
  email: "We'll use this email for login and order updates.",
  password: 'Use at least 8 characters with 1 uppercase, 1 lowercase, and 1 number.',
  confirmPassword: 'Re-enter the same password.',
} as const;

const FALLBACK_SERVER_ERROR =
  "We couldn't create your account. Please review your details and try again.";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type RegisterField = 'name' | 'email' | 'password' | 'confirmPassword';

function hasUppercase(value: string) {
  return /[A-Z]/.test(value);
}

function hasLowercase(value: string) {
  return /[a-z]/.test(value);
}

function hasNumber(value: string) {
  return /\d/.test(value);
}

function getNameError(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return 'Full name is required';
  if (trimmed.length < 2) return 'Please enter at least 2 characters';
  return null;
}

function getEmailError(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return 'Email address is required';
  if (!EMAIL_REGEX.test(trimmed)) return 'Enter a valid email address';
  return null;
}

function getPasswordError(value: string) {
  if (!value) return 'Password is required';
  if (value.length < 8) return 'Password must be at least 8 characters';
  if (!hasUppercase(value) || !hasLowercase(value) || !hasNumber(value)) {
    return 'Password must include uppercase, lowercase, and a number';
  }
  return null;
}

function getConfirmPasswordError(confirmPassword: string, password: string) {
  if (!confirmPassword) return 'Confirm your password';
  if (confirmPassword !== password) return 'Passwords do not match';
  return null;
}

function mapRegisterError(err: any) {
  const payload = err?.payload ?? {};
  const status = Number(err?.status || 0);

  const candidates = [
    payload?.error,
    payload?.code,
    payload?.message,
    payload?.detail,
    err?.error,
    err?.message,
  ]
    .filter(Boolean)
    .map((value) => String(value).trim())
    .filter(Boolean);

  for (const candidate of candidates) {
    const normalized = candidate.toLowerCase();

    if (
      normalized === 'validation_error' ||
      normalized === 'bad_request' ||
      normalized === 'invalid_request' ||
      normalized === 'invalid_input' ||
      normalized === 'server_error' ||
      normalized === 'internal_server_error' ||
      normalized === 'request_validation_failed'
    ) {
      return FALLBACK_SERVER_ERROR;
    }

    if (
      /already exists|email.*taken|duplicate.*email|email.*already/i.test(candidate)
    ) {
      return 'An account with this email already exists. Try logging in instead.';
    }

    if (/invalid.*email|email.*invalid|email.*format/i.test(candidate)) {
      return 'Enter a valid email address';
    }

    if (
      /password.*(must|invalid|weak|uppercase|lowercase|number|8|min)/i.test(candidate)
    ) {
      return 'Password must include uppercase, lowercase, and a number';
    }

    if (/name.*required|full name/i.test(candidate)) {
      return 'Full name is required';
    }

    if (/confirm.*password|passwords?.*match/i.test(candidate)) {
      return 'Passwords do not match';
    }

    if (/(validation|invalid input|bad request)/i.test(candidate)) {
      return FALLBACK_SERVER_ERROR;
    }

    if (!/^[a-z0-9_]+$/i.test(candidate)) {
      return candidate;
    }
  }

  if (status >= 500) {
    return 'Something went wrong on our side. Please try again.';
  }

  return FALLBACK_SERVER_ERROR;
}

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
  const [touched, setTouched] = useState<Record<RegisterField, boolean>>({
    name: false,
    email: false,
    password: false,
    confirmPassword: false,
  });
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const submittingRef = useRef(false);

  const fieldErrors: Record<RegisterField, string | null> = {
    name: getNameError(name),
    email: getEmailError(email),
    password: getPasswordError(password),
    confirmPassword: getConfirmPasswordError(confirmPassword, password),
  };

  const passwordChecks = [
    { label: '8+ characters', ok: password.length >= 8 },
    { label: 'Uppercase letter', ok: hasUppercase(password) },
    { label: 'Lowercase letter', ok: hasLowercase(password) },
    { label: 'Number', ok: hasNumber(password) },
  ];

  const hasValidationErrors = Object.values(fieldErrors).some(Boolean);
  const hasTouchedField = Object.values(touched).some(Boolean);
  const disableSubmit =
    loading || ((submitAttempted || hasTouchedField) && hasValidationErrors);

  const inputClassName = (isInvalid: boolean) =>
    [
      'h-12 w-full rounded-2xl border bg-slate-50 px-5 text-base text-slate-900 outline-none transition',
      'dark:bg-white/[0.03] dark:text-white',
      isInvalid
        ? 'border-rose-400/80 focus:border-rose-400 dark:border-rose-400/60 dark:focus:border-rose-300'
        : 'border-slate-200 focus:border-slate-900 dark:border-white/10 dark:focus:border-white/30',
    ].join(' ');

  const setFieldTouched = (field: RegisterField) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const shouldShowError = (field: RegisterField) =>
    (touched[field] || submitAttempted) && Boolean(fieldErrors[field]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || submittingRef.current) return;
    submittingRef.current = true;

    setSubmitAttempted(true);
    setTouched({
      name: true,
      email: true,
      password: true,
      confirmPassword: true,
    });
    setFormError(null);

    if (hasValidationErrors) {
      submittingRef.current = false;
      return;
    }

    setLoading(true);
    try {
      const res: any = await apiPost('/auth/register', {
        name: name.trim(),
        email: email.trim(),
        password,
        role: 'buyer',
      });

      const token = res?.accessToken || res?.token;
      if (token) {
        setAccessToken(token);
        navigate(safeRedirectTarget);
      } else {
        navigate(`/fan/login?returnTo=${encodeURIComponent(safeRedirectTarget)}`);
      }
    } catch (err: any) {
      setFormError(mapRegisterError(err));
    } finally {
      setLoading(false);
      submittingRef.current = false;
    }
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
              Create Account
            </h1>
            <p className="mt-4 text-sm text-slate-500 dark:text-white/60">
              Join the OfficialMerch community.
            </p>
          </div>

          {formError && (
            <div
              role="alert"
              data-testid="fan-register-form-error"
              className="mb-6 w-full rounded-2xl border border-rose-300/70 bg-rose-50 p-4 text-sm font-medium text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
            >
              {formError}
            </div>
          )}

          <form
            onSubmit={handleSubmit}
            className="w-full space-y-4"
            noValidate
            data-testid="fan-register-form"
          >
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
                data-testid="fan-register-name"
                autoComplete="name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setFormError(null);
                }}
                onBlur={() => setFieldTouched('name')}
                aria-invalid={shouldShowError('name')}
                aria-describedby="name-helper"
                className={inputClassName(shouldShowError('name'))}
                placeholder="John Doe"
              />
              <p
                id="name-helper"
                className={`min-h-[1.25rem] px-1 text-xs ${
                  shouldShowError('name')
                    ? 'text-rose-600 dark:text-rose-300'
                    : 'text-slate-500 dark:text-white/45'
                }`}
              >
                {shouldShowError('name') ? fieldErrors.name : FIELD_HELPERS.name}
              </p>
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
                data-testid="fan-register-email"
                autoComplete="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setFormError(null);
                }}
                onBlur={() => setFieldTouched('email')}
                aria-invalid={shouldShowError('email')}
                aria-describedby="email-helper"
                className={inputClassName(shouldShowError('email'))}
                placeholder="name@example.com"
              />
              <p
                id="email-helper"
                className={`min-h-[1.25rem] px-1 text-xs ${
                  shouldShowError('email')
                    ? 'text-rose-600 dark:text-rose-300'
                    : 'text-slate-500 dark:text-white/45'
                }`}
              >
                {shouldShowError('email') ? fieldErrors.email : FIELD_HELPERS.email}
              </p>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="password"
                className="px-1 text-sm font-medium text-slate-500 dark:text-white/40"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  data-testid="fan-register-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setFormError(null);
                  }}
                  onBlur={() => setFieldTouched('password')}
                  aria-invalid={shouldShowError('password')}
                  aria-describedby="password-helper password-checklist"
                  className={`${inputClassName(shouldShowError('password'))} pr-20`}
                  placeholder="********"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full border border-slate-200 bg-slate-100 px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-500 transition hover:bg-slate-200 hover:text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-white/40 dark:hover:bg-white/10 dark:hover:text-white"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
              <p
                id="password-helper"
                className={`min-h-[1.25rem] px-1 text-xs ${
                  shouldShowError('password')
                    ? 'text-rose-600 dark:text-rose-300'
                    : 'text-slate-500 dark:text-white/45'
                }`}
              >
                {shouldShowError('password') ? fieldErrors.password : FIELD_HELPERS.password}
              </p>
              <div
                id="password-checklist"
                className="rounded-xl border border-slate-200/80 bg-slate-50/80 px-3 py-2 dark:border-white/10 dark:bg-white/[0.02]"
              >
                <p className="mb-1 text-[11px] uppercase tracking-widest text-slate-500 dark:text-white/40">
                  Password requirements
                </p>
                <ul className="space-y-1">
                  {passwordChecks.map((check) => (
                    <li
                      key={check.label}
                      data-testid={`fan-register-password-check-${check.label
                        .toLowerCase()
                        .replace(/[^a-z0-9]+/g, '-')}`}
                      className={`text-xs ${
                        check.ok
                          ? 'text-emerald-600 dark:text-emerald-300'
                          : 'text-slate-500 dark:text-white/45'
                      }`}
                    >
                      {check.ok ? '[ok]' : '[ ]'} {check.label}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="confirmPassword"
                className="px-1 text-sm font-medium text-slate-500 dark:text-white/40"
              >
                Confirm Password
              </label>
              <div className="relative">
                <input
                  id="confirmPassword"
                  data-testid="fan-register-confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    setFormError(null);
                  }}
                  onBlur={() => setFieldTouched('confirmPassword')}
                  aria-invalid={shouldShowError('confirmPassword')}
                  aria-describedby="confirm-password-helper"
                  className={`${inputClassName(shouldShowError('confirmPassword'))} pr-20`}
                  placeholder="********"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full border border-slate-200 bg-slate-100 px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-500 transition hover:bg-slate-200 hover:text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-white/40 dark:hover:bg-white/10 dark:hover:text-white"
                  aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                >
                  {showConfirmPassword ? 'Hide' : 'Show'}
                </button>
              </div>
              <p
                id="confirm-password-helper"
                className={`min-h-[1.25rem] px-1 text-xs ${
                  shouldShowError('confirmPassword')
                    ? 'text-rose-600 dark:text-rose-300'
                    : 'text-slate-500 dark:text-white/45'
                }`}
              >
                {shouldShowError('confirmPassword')
                  ? fieldErrors.confirmPassword
                  : FIELD_HELPERS.confirmPassword}
              </p>
            </div>

            <button
              data-testid="fan-register-submit"
              type="submit"
              disabled={disableSubmit}
              className="mt-6 h-14 w-full rounded-2xl bg-slate-900 text-base font-bold text-white transition hover:bg-slate-800 disabled:opacity-50 dark:bg-[#9c9c9c] dark:text-black dark:hover:bg-[#b0b0b0]"
            >
              {loading ? 'Creating account...' : 'Sign Up'}
            </button>
          </form>

          <div className="mt-8 flex flex-col items-center gap-2 text-sm text-slate-500 dark:text-white/40">
            <p>
              Already have an account?{' '}
              <Link
                to={loginLinkTarget}
                className="font-semibold text-slate-900 underline underline-offset-4 dark:text-white"
              >
                Login
              </Link>
            </p>
            <p>
              Are you an artist?{' '}
              <Link
                to={partnerLinkTarget}
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
