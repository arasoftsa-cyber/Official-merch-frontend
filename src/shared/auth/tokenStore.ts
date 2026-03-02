let accessToken: string | null = null;
let refreshToken: string | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string): void {
  accessToken = token || null;
}

export function getRefreshToken(): string | null {
  return refreshToken;
}

export function setRefreshToken(token: string): void {
  refreshToken = token || null;
}

export function clearTokens(): void {
  accessToken = null;
  refreshToken = null;
}
