import API_BASE_CONFIG from '@/config/apiBase';

export function getApiBaseUrl(): string {
  const resolved = String(API_BASE_CONFIG || '').trim();
  if (!resolved) {
    throw new Error('API base URL is not configured');
  }
  return resolved.replace(/\/+$/, '');
}

export const API_BASE = getApiBaseUrl();
