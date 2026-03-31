/**
 * Admin console client utilities.
 *
 * Browser pages call the admin console's own Next.js API routes (same-origin).
 * These routes run server-side and authenticate via the ADMIN_CONSOLE_API_KEY
 * env var — the browser never sees or sends the key. No session cookie is
 * needed; the API routes are the auth boundary.
 *
 * For server-to-server callers (e.g. CI, scripts), pass the key via
 * `X-Admin-Key` or `Authorization: Bearer <key>` header.
 */

/**
 * Returns headers for browser -> Next.js API route calls.
 *
 * SECURITY: The admin API key must NEVER be exposed to the browser.
 * Browser requests rely on same-origin trust — the Next.js server validates
 * the request itself. No auth header is needed from the browser.
 */
export function getAdminAuthHeaders(): HeadersInit {
  return {};
}

/**
 * Returns the RequestInit options that every browser-side admin fetch should use.
 * Ensures cookies are sent with same-origin requests (for any future session
 * integration) and signals same-origin context to the server.
 */
export function getAdminFetchOptions(): RequestInit {
  return { credentials: "include" };
}
