import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Label from '../../components/ui/Label';
import {
  setAccessToken,
  setRefreshToken,
} from '../../shared/auth/tokenStore';
import { registerBuyer } from '../../lib/api/auth';

const extractToken = (payload: Record<string, any>) => {
  const accessToken =
    payload?.accessToken ||
    payload?.token ||
    payload?.data?.accessToken ||
    payload?.access_token ||
    null;
  const refreshToken =
    payload?.refreshToken ||
    payload?.data?.refreshToken ||
    payload?.refresh_token ||
    null;
  return { accessToken, refreshToken };
};

export default function FanRegisterPage() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (!email.trim()) {
      setError('Email is required');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      const payload = await registerBuyer({
        name: name.trim() || undefined,
        email: email.trim(),
        password,
      });
      const { accessToken, refreshToken } = extractToken(payload);
      if (accessToken) {
        setAccessToken(accessToken);
        if (refreshToken) {
          setRefreshToken(refreshToken);
        }
        navigate('/fan', { replace: true });
        return;
      }
      navigate('/fan/login', { replace: true });
    } catch (err: any) {
      setError(err?.message ?? 'Registration failed');
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
          <h1 className="text-3xl font-semibold tracking-tight text-white">Fan register</h1>
          <p className="mt-2 text-sm text-white/70">Create a buyer account for OfficialMerch.</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5 mt-8">
          <div className="space-y-2">
            <Label htmlFor="fan-name" className="text-sm text-white/60">
              Name
            </Label>
            <Input
              id="fan-name"
              type="text"
              name="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Your name"
              className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 outline-none transition focus:ring-2 focus:ring-white/20 placeholder:text-slate-400"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fan-email" className="text-sm text-white/60">
              Email
            </Label>
            <Input
              id="fan-email"
              type="email"
              name="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              placeholder="you@example.com"
              className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 outline-none transition focus:ring-2 focus:ring-white/20 placeholder:text-slate-400"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fan-password" className="text-sm text-white/60">
              Password
            </Label>
            <Input
              id="fan-password"
              type="password"
              name="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              placeholder="••••••••"
              className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 outline-none transition focus:ring-2 focus:ring-white/20 placeholder:text-slate-400"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fan-confirm-password" className="text-sm text-white/60">
              Confirm password
            </Label>
            <Input
              id="fan-confirm-password"
              type="password"
              name="confirmPassword"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
              placeholder="••••••••"
              className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 outline-none transition focus:ring-2 focus:ring-white/20 placeholder:text-slate-400"
            />
          </div>
          <div className="min-h-[2.5rem]">
            {error && (
              <div role="alert" className="rounded-xl bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-200">
                {error}
              </div>
            )}
          </div>
          <button
            type="submit"
            disabled={loading || !email || !password || !confirmPassword}
            aria-busy={loading}
            className="mt-2 w-full rounded-2xl bg-white/95 text-black py-3 font-medium transition hover:bg-white active:opacity-90 disabled:opacity-60"
          >
            Create account
          </button>
        </form>
        <p className="text-xs text-center text-slate-400 mt-4 space-y-2">
          <span>Already have an account? <Link className="underline" to="/fan/login">Login</Link>.</span>
          <span>Partner? <Link className="underline" to="/partner/login">Login here</Link>.</span>
        </p>
      </Card>
    </div>
  );
}
