import { API_BASE } from '../shared/api/baseUrl';
import { getAccessToken } from '../shared/auth/tokenStore';

function buildHeaders() {
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  const token = getAccessToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

async function parseJson(response: Response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return text;
  }
}

function errorFromPayload(payload: any, status: number) {
  const message =
    payload?.error ||
    payload?.message ||
    payload?.detail ||
    payload?.statusText ||
    `HTTP_${status}`;
  const error = new Error(String(message));
  (error as any).status = status;
  (error as any).payload = payload;
  (error as any).error = payload?.error;
  return error;
}

function normalizePath(path: string) {
  const rawPath = String(path ?? '');
  const trimmedPath = rawPath.trim();
  const queryIndex = trimmedPath.indexOf('?');
  const hashIndex = trimmedPath.indexOf('#');
  const splitIndex =
    queryIndex >= 0 && hashIndex >= 0
      ? Math.min(queryIndex, hashIndex)
      : Math.max(queryIndex, hashIndex);

  const pathSegment = splitIndex === -1 ? trimmedPath : trimmedPath.slice(0, splitIndex);
  const suffix = splitIndex === -1 ? '' : trimmedPath.slice(splitIndex);
  const noWhitespacePath = pathSegment.replace(/\s+/g, '');
  const withLeadingSlash = noWhitespacePath.startsWith('/') ? noWhitespacePath : `/${noWhitespacePath}`;
  const apiPath = withLeadingSlash.startsWith('/api/') || withLeadingSlash === '/api'
    ? withLeadingSlash
    : `/api${withLeadingSlash}`;

  return `${apiPath}${suffix}`;
}

export async function apiGet(path: string) {
  const clean = normalizePath(path);
  const url = `${API_BASE}${clean}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: buildHeaders(),
    credentials: 'include',
  });
  const payload = await parseJson(response);
  if (!response.ok) {
    throw errorFromPayload(payload, response.status);
  }
  return payload;
}

export async function apiPost(path: string, body?: any) {
  const clean = normalizePath(path);
  const url = `${API_BASE}${clean}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      ...buildHeaders(),
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'include',
  });
  const payload = await parseJson(response);
  if (!response.ok) {
    throw errorFromPayload(payload, response.status);
  }
  return payload;
}
