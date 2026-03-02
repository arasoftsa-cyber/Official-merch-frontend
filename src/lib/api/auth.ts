import { apiFetch } from '../../shared/api/http';

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
  return apiFetch('/auth/refresh', {
    method: 'POST',
    body: {},
  });
}

export async function logoutAuth(): Promise<AuthResponse> {
  return apiFetch('/auth/logout', {
    method: 'POST',
    body: {},
  });
}
