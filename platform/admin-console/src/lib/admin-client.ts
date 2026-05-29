/**
 * Admin console client utilities.
 *
 * API routes require an explicit admin key header. Until the console has a
 * real session login flow, operators can paste the key into this tab; it is
 * held only in sessionStorage and attached to same-origin admin API requests.
 */

export const ADMIN_API_KEY_STORAGE_KEY = "neo-miniapps.admin-api-key";
export const ADMIN_API_KEY_CHANGED_EVENT = "neo-miniapps.admin-api-key.changed";

function getSessionStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  return window.sessionStorage;
}

export function getStoredAdminApiKey(): string {
  try {
    return getSessionStorage()?.getItem(ADMIN_API_KEY_STORAGE_KEY)?.trim() || "";
  } catch {
    return "";
  }
}

export function hasStoredAdminApiKey(): boolean {
  return Boolean(getStoredAdminApiKey());
}

export function setStoredAdminApiKey(value: string): void {
  const storage = getSessionStorage();
  if (!storage || typeof window === "undefined") return;

  const trimmed = value.trim();
  if (trimmed) {
    storage.setItem(ADMIN_API_KEY_STORAGE_KEY, trimmed);
  } else {
    storage.removeItem(ADMIN_API_KEY_STORAGE_KEY);
  }

  window.dispatchEvent(new Event(ADMIN_API_KEY_CHANGED_EVENT));
}

/**
 * Returns headers for browser -> Next.js API route calls.
 */
export function getAdminAuthHeaders(): HeadersInit {
  const key = getStoredAdminApiKey();
  return key ? { "X-Admin-Key": key } : {};
}

/**
 * Returns the RequestInit options that every browser-side admin fetch should use.
 * Ensures cookies are sent with same-origin requests (for any future session
 * integration) and signals same-origin context to the server.
 */
export function getAdminFetchOptions(): RequestInit {
  return { credentials: "include" };
}
