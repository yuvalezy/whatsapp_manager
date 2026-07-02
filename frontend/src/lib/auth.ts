// ============================================================================
// Auth token storage + a global "unauthorized" signal.
//
// The personal-login JWT has no expiry, so it lives in localStorage and
// survives browser restarts — you log in once per browser and stay in until you
// log out (or the server's JWT_SECRET is rotated, which 401s every request).
// ============================================================================

const TOKEN_KEY = 'wm_token';
const UNAUTHORIZED_EVENT = 'wm:unauthorized';

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* ignore (private mode / storage disabled) */
  }
}

export function clearToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

/** Fire-and-forget notice that the API rejected our credential (401). */
export function emitUnauthorized(): void {
  window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
}

/** Subscribe to unauthorized events; returns an unsubscribe fn. */
export function onUnauthorized(handler: () => void): () => void {
  window.addEventListener(UNAUTHORIZED_EVENT, handler);
  return () => window.removeEventListener(UNAUTHORIZED_EVENT, handler);
}
