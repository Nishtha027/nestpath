import { decodeJwtPayload } from "./jwt";

// The login survives a page refresh by living in sessionStorage -- per-tab,
// and gone when the tab closes (unlike localStorage). Anything on the page,
// including injected script, can read it; see "Known limitations" in the
// README.
//
// Exposed as a tiny external store so React can read it with
// useSyncExternalStore (consistent server/client renders, no
// restore-in-an-effect).

const KEY = "nestpath.session";

// If sessionStorage is unavailable (blocked, or some private modes), the
// session still works for the life of the page by falling back to memory.
let memoryFallback: string | null = null;
let storageWorks = true;

const listeners = new Set<() => void>();
function notify() {
  listeners.forEach((listener) => listener());
}

export function subscribeToSession(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function isExpired(raw: string): boolean {
  try {
    const { token } = JSON.parse(raw) as { token: string };
    const payload = decodeJwtPayload(token);
    return !payload || payload.exp * 1000 <= Date.now();
  } catch {
    return true;
  }
}

/** The stored session as a JSON string, or null if there's none or it has
 * expired (an expired one is dropped). A string, so React can compare
 * snapshots by value. */
export function getStoredSession(): string | null {
  let raw: string | null;
  if (storageWorks) {
    try {
      raw = sessionStorage.getItem(KEY);
    } catch {
      storageWorks = false;
      raw = memoryFallback;
    }
  } else {
    raw = memoryFallback;
  }
  if (raw !== null && isExpired(raw)) {
    clearSession();
    return null;
  }
  return raw;
}

/** What the server renders (and the first client render must match): signed out. */
export function getServerSession(): string | null {
  return null;
}

export function storeSession(session: { token: string; email: string }) {
  const raw = JSON.stringify(session);
  memoryFallback = raw;
  try {
    sessionStorage.setItem(KEY, raw);
  } catch {
    storageWorks = false;
  }
  notify();
}

export function clearSession() {
  memoryFallback = null;
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // nothing stored to clear
  }
  notify();
}

export function parseSession(raw: string | null): { token: string; email: string } | null {
  if (!raw) return null;
  try {
    const { token, email } = JSON.parse(raw) as { token: string; email: string };
    return token && email ? { token, email } : null;
  } catch {
    return null;
  }
}
