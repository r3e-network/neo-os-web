/**
 * Returns headers for browser → Next.js API route calls.
 *
 * SECURITY: The admin API key must NEVER be exposed to the browser.
 * Browser requests rely on cookie-based session auth (credentials: "include")
 * instead of sending an API key header. The Next.js API routes validate the
 * session server-side and inject the admin key when proxying to upstream services.
 */
export function getAdminAuthHeaders(): HeadersInit {
  return {};
}

/**
 * Returns the RequestInit options that every browser-side admin fetch should use.
 * Ensures cookies (session token) are sent with same-origin requests.
 */
export function getAdminFetchOptions(): RequestInit {
  return { credentials: "include" };
}
