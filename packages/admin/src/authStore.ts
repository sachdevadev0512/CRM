const STORAGE_KEY = 'mv_admin_session';
const API_BASE_URL = ((import.meta as any).env.VITE_API_BASE_URL || '').replace(/\/+$/, '');

interface StoredSession {
  access_token: string;
  refresh_token: string;
  expires_at: number; // unix seconds
}

function readSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeSession(session: StoredSession | null) {
  if (!session) {
    localStorage.removeItem(STORAGE_KEY);
  } else {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  }
}

// Concurrent callers (e.g. several data fetches firing at once right after a token expires)
// share one in-flight refresh instead of each hitting /api/auth/refresh separately.
let refreshPromise: Promise<string | null> | null = null;

async function refreshSession(session: StoredSession): Promise<StoredSession | null> {
  const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: session.refresh_token }),
  });
  if (!response.ok) return null;
  const data = await response.json().catch(() => null);
  if (!data?.access_token) return null;

  const next: StoredSession = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: data.expires_at,
  };
  writeSession(next);
  return next;
}

export const authStore = {
  setSession(session: StoredSession) {
    writeSession(session);
  },

  clearSession() {
    writeSession(null);
  },

  hasSession(): boolean {
    return !!readSession();
  },

  getRefreshToken(): string | null {
    return readSession()?.refresh_token || null;
  },

  // Returns a currently-valid access token, transparently refreshing first if the stored one
  // is expired or expiring within 60 seconds. Returns null (and clears the session) if there's
  // no session or the refresh itself fails.
  async getValidAccessToken(): Promise<string | null> {
    const session = readSession();
    if (!session) return null;

    const nowSeconds = Math.floor(Date.now() / 1000);
    if (session.expires_at - nowSeconds > 60) {
      return session.access_token;
    }

    if (!refreshPromise) {
      refreshPromise = refreshSession(session)
        .then((next) => next?.access_token || null)
        .finally(() => {
          refreshPromise = null;
        });
    }

    const token = await refreshPromise;
    if (!token) writeSession(null);
    return token;
  },
};
