import { apiFetch } from './http';

const asArray = <T>(payload: any): T[] => {
  if (Array.isArray(payload)) return payload as T[];
  if (Array.isArray(payload?.items)) return payload.items as T[];
  return [];
};

export async function getMe() {
  return apiFetch('/auth/whoami');
}

export async function getConfig() {
  return apiFetch('/config');
}

export async function getRoles() {
  return apiFetch('/roles');
}

export async function fetchFeaturedArtists<T = any>(): Promise<T[]> {
  try {
    const payload = await apiFetch('/artists/featured');
    return asArray<T>(payload);
  } catch (error: any) {
    throw new Error(error?.message || 'Failed to load featured artists');
  }
}

export async function fetchFeaturedDrops<T = any>(): Promise<T[]> {
  try {
    const payload = await apiFetch('/drops/featured');
    return asArray<T>(payload);
  } catch (error: any) {
    throw new Error(error?.message || 'Failed to load featured drops');
  }
}
