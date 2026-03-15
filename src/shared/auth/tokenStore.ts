type SessionTokens = {
  accessToken: string | null;
  refreshToken: string | null;
};

type SessionUpdate = {
  accessToken?: string | null;
  refreshToken?: string | null;
};

export const AUTH_SESSION_STORAGE_KEY = 'om_auth_session_v1';

let accessToken: string | null = null;
let refreshToken: string | null = null;
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
    };
  }

  try {
    const rawValue = storage.getItem(AUTH_SESSION_STORAGE_KEY);
    if (!rawValue) {
      return {
        accessToken: null,
        refreshToken: null,
      };
    }

    const parsed = JSON.parse(rawValue);
    return {
      accessToken: null,
      refreshToken: normalizeToken(parsed?.refreshToken),
    };
  } catch {
    storage.removeItem(AUTH_SESSION_STORAGE_KEY);
    return {
      accessToken: null,
      refreshToken: null,
    };
  }
};

export function loadPersistedSession(): SessionTokens {
  if (!persistedSessionLoaded) {
    const persisted = readPersistedSession();
    if (!refreshToken) {
      refreshToken = persisted.refreshToken;
    }
    persistedSessionLoaded = true;
  }

  return {
    accessToken,
    refreshToken,
  };
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function getRefreshToken(): string | null {
  return loadPersistedSession().refreshToken;
}

export function setSession(update: SessionUpdate): SessionTokens {
  if (Object.prototype.hasOwnProperty.call(update, 'accessToken')) {
    accessToken = normalizeToken(update.accessToken);
  }
  if (Object.prototype.hasOwnProperty.call(update, 'refreshToken')) {
    refreshToken = normalizeToken(update.refreshToken);
  }
  persistedSessionLoaded = true;
  writePersistedSession();

  return {
    accessToken,
    refreshToken,
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
  persistedSessionLoaded = true;
  writePersistedSession();
}

export function clearTokens(): void {
  clearSession();
}

export function __resetSessionStoreForTests(): void {
  accessToken = null;
  refreshToken = null;
  persistedSessionLoaded = false;
}
