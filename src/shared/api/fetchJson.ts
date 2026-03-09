import { apiFetch } from './http';

export async function fetchJson<T>(path: string, options?: RequestInit): Promise<T> {
  return apiFetch(path, options) as Promise<T>;
}
