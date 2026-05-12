type SessionTokens = {
  accessToken: string | null;
  refreshToken: string | null;
  user: SessionUser | null;
};

export type SessionUser = {
  id?: string | null;
  email?: string | null;
  role?: string | null;
};

type SessionUpdate = {
  accessToken?: string | null;
  refreshToken?: string | null;
  user?: SessionUser | null;
};

export const AUTH_SESSION_STORAGE_KEY = 'om_auth_session_v1';

let accessToken: string | null = null;
let refreshToken: string | null = null;
let sessionUser: SessionUser | null = null;
let persistedSessionLoaded = false;

const normalizeToken = (token: string | null | undefined): string | null => {
  const normalized = String(token || '').trim();
  return normalized || null;
};

const getSessionStorage = (): Storage | null => {
  try {
    return globalThis.sessionStorage ?? null;
  } catch {
    return null;
  }
};

const normalizeUser = (value: any): SessionUser | null => {
  if (!value || typeof value !== 'object') return null;
  const id = typeof value?.id === 'string' ? value.id.trim() : '';
  const email = typeof value?.email === 'string' ? value.email.trim() : '';
  const role = typeof value?.role === 'string' ? value.role.trim().toLowerCase() : '';
  if (!id && !email && !role) return null;
  return {
    id: id || null,
    email: email || null,
    role: role || null,
  };
};

const decodeBase64Url = (value: string): string | null => {
  const normalized = String(value || '').trim();
  if (!normalized) return null;
  const padded = normalized.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  try {
    return globalThis.atob?.(padded) ?? null;
  } catch {
    return null;
  }
};

const parseUserFromAccessToken = (token: string | null | undefined): SessionUser | null => {
  const normalized = normalizeToken(token);
  if (!normalized) return null;
  const parts = normalized.split('.');
  if (parts.length < 2) return null;
  const payloadText = decodeBase64Url(parts[1]);
  if (!payloadText) return null;
  try {
    const payload = JSON.parse(payloadText);
    return normalizeUser({
      id: payload?.sub,
      email: payload?.email,
      role: payload?.role,
    });
  } catch {
    return null;
  }
};

const writePersistedSession = (): void => {
  const storage = getSessionStorage();
  if (!storage) return;

  try {
    if (!refreshToken) {
      storage.removeItem(AUTH_SESSION_STORAGE_KEY);
      return;
    }

    storage.setItem(
      AUTH_SESSION_STORAGE_KEY,
      JSON.stringify({
        refreshToken,
        user: sessionUser,
      })
    );
  } catch {
    // Ignore browser storage restrictions.
  }
};

const readPersistedSession = (): SessionTokens => {
  const storage = getSessionStorage();
  if (!storage) {
    return {
      accessToken: null,
      refreshToken: null,
      user: null,
    };
  }

  try {
    const rawValue = storage.getItem(AUTH_SESSION_STORAGE_KEY);
    if (!rawValue) {
      return {
        accessToken: null,
        refreshToken: null,
        user: null,
      };
    }

    const parsed = JSON.parse(rawValue);
    return {
      accessToken: null,
      refreshToken: normalizeToken(parsed?.refreshToken),
      user: normalizeUser(parsed?.user),
    };
  } catch {
    storage.removeItem(AUTH_SESSION_STORAGE_KEY);
    return {
      accessToken: null,
      refreshToken: null,
      user: null,
    };
  }
};

export function loadPersistedSession(): SessionTokens {
  if (!persistedSessionLoaded) {
    const persisted = readPersistedSession();
    if (!refreshToken) {
      refreshToken = persisted.refreshToken;
    }
    if (!sessionUser) {
      sessionUser = persisted.user;
    }
    persistedSessionLoaded = true;
  }

  return {
    accessToken,
    refreshToken,
    user: sessionUser,
  };
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function getRefreshToken(): string | null {
  return loadPersistedSession().refreshToken;
}

export function getSessionUser(): SessionUser | null {
  return loadPersistedSession().user;
}

export function setSession(update: SessionUpdate): SessionTokens {
  if (Object.prototype.hasOwnProperty.call(update, 'accessToken')) {
    accessToken = normalizeToken(update.accessToken);
  }
  if (Object.prototype.hasOwnProperty.call(update, 'refreshToken')) {
    refreshToken = normalizeToken(update.refreshToken);
  }
  if (Object.prototype.hasOwnProperty.call(update, 'user')) {
    sessionUser = normalizeUser(update.user);
  } else if (accessToken && !sessionUser) {
    sessionUser = parseUserFromAccessToken(accessToken);
  }
  persistedSessionLoaded = true;
  writePersistedSession();

  return {
    accessToken,
    refreshToken,
    user: sessionUser,
  };
}

export function setAccessToken(token: string): void {
  setSession({ accessToken: token });
}

export function setRefreshToken(token: string): void {
  setSession({ refreshToken: token });
}

export function clearSession(): void {
  accessToken = null;
  refreshToken = null;
  sessionUser = null;
  persistedSessionLoaded = true;
  writePersistedSession();
}

export function clearTokens(): void {
  clearSession();
}

export function __resetSessionStoreForTests(): void {
  accessToken = null;
  refreshToken = null;
  sessionUser = null;
  persistedSessionLoaded = false;
}
