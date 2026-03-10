import { apiFetch } from './http';
import { getRefreshToken } from '../auth/tokenStore';

export type AuthPayload = {
  name?: string;
  email: string;
  password: string;
};

export type AuthResponse = Record<string, any>;

export async function login({ email, password }: AuthPayload): Promise<AuthResponse> {
  return apiFetch('/auth/login', {
    method: 'POST',
    body: { email, password },
  });
}

export async function registerBuyer({
  name,
  email,
  password,
}: AuthPayload): Promise<AuthResponse> {
  return apiFetch('/auth/register', {
    method: 'POST',
    body: { name, email, password, role: 'buyer' },
  });
}

export async function refreshAuth(): Promise<AuthResponse> {
  const refreshToken = getRefreshToken();
  return apiFetch('/auth/refresh', {
    method: 'POST',
    body: { refreshToken },
  });
}

export async function logoutAuth(): Promise<AuthResponse> {
  const refreshToken = getRefreshToken();
  return apiFetch('/auth/logout', {
    method: 'POST',
    body: { refreshToken },
  });
}

export async function forgotPassword(email: string): Promise<AuthResponse> {
  return apiFetch('/auth/password/forgot', {
    method: 'POST',
    body: { email },
  });
}

export async function resetPassword(token: string, password: string): Promise<AuthResponse> {
  return apiFetch('/auth/password/reset', {
    method: 'POST',
    body: { token, password },
  });
}
