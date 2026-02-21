import { API_BASE } from '../shared/api/baseUrl';

function getToken(): string | null {
  return (
    localStorage.getItem('auth_access_token') ||
    localStorage.getItem('auth_token') ||
    null
  );
}

function buildHeaders() {
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  const token = getToken();
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
  return error;
}

export async function apiGet(path: string) {
  const url = `${API_BASE}${path}`;
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
  const url = `${API_BASE}${path}`;
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
