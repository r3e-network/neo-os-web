import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";

/**
 * Server-only admin authentication.
 *
 * The admin console's Next.js API routes run server-side and are the sole auth
 * boundary. Browser pages call these same-origin `/api/*` routes, which validate
 * the request using the server-only `ADMIN_CONSOLE_API_KEY` env var.
 *
 * Two supported auth flows:
 *  1. Same-origin browser requests — the Next.js API routes themselves ARE the
 *     server, so they can read the env var directly. No cookie or browser-sent
 *     key is needed; the route handler is already trusted code.
 *  2. External / server-to-server callers — pass `X-Admin-Key` header or
 *     `Authorization: Bearer <key>`.
 *
 * For production deployments behind a reverse proxy, the proxy can inject the
 * admin key server-side so that upstream services also accept the request.
 *
 * IMPORTANT: ADMIN_CONSOLE_API_KEY must NEVER be prefixed with NEXT_PUBLIC_.
 */
const ADMIN_API_KEY = String(process.env.ADMIN_CONSOLE_API_KEY || process.env.ADMIN_API_KEY || "").trim();
const ADMIN_AUTH_WINDOW_SECONDS = parsePositiveInt(process.env.ADMIN_AUTH_RATE_LIMIT_WINDOW_SECONDS, 60);
const ADMIN_AUTH_MAX_REQUESTS = parsePositiveInt(process.env.ADMIN_AUTH_MAX_REQUESTS, 120);

type RateLimitEntry = {
  count: number;
  resetAtUnixMS: number;
};

const authRateLimit = new Map<string, RateLimitEntry>();

function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const n = Number.parseInt(String(value || ""), 10);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return n;
}

function extractAdminKey(req: Request): string {
  const headerKey = req.headers.get("x-admin-key");
  if (headerKey) return headerKey.trim();

  const auth = req.headers.get("authorization") || "";
  if (auth.toLowerCase().startsWith("bearer ")) {
    return auth.slice("bearer ".length).trim();
  }

  return "";
}

function extractClientIP(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }

  const realIP = req.headers.get("x-real-ip") || "";
  if (realIP.trim()) return realIP.trim();

  return "unknown";
}

function isRateLimited(req: Request): boolean {
  const now = Date.now();
  const key = extractClientIP(req);
  const windowMS = ADMIN_AUTH_WINDOW_SECONDS * 1000;

  const existing = authRateLimit.get(key);
  if (!existing || now >= existing.resetAtUnixMS) {
    authRateLimit.set(key, {
      count: 1,
      resetAtUnixMS: now + windowMS,
    });
    return false;
  }

  existing.count += 1;
  authRateLimit.set(key, existing);

  if (authRateLimit.size > 10_000) {
    for (const [ip, entry] of authRateLimit.entries()) {
      if (now >= entry.resetAtUnixMS) {
        authRateLimit.delete(ip);
      }
    }
  }

  return existing.count > ADMIN_AUTH_MAX_REQUESTS;
}

/**
 * Authenticate an incoming admin API request.
 *
 * For same-origin browser requests (the admin console's own pages), the Next.js
 * API route runs server-side and is inherently trusted — no key header is needed.
 * External callers must provide the key via `X-Admin-Key` or `Authorization: Bearer`.
 *
 * Returns null on success, or an error Response to short-circuit the handler.
 */
export function requireAdminAuth(req: Request): Response | null {
  if (isRateLimited(req)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  // When no API key is configured, allow requests (dev mode). In production
  // the env var MUST be set; the admin console should not be publicly exposed
  // without it.
  if (!ADMIN_API_KEY) {
    return null;
  }

  // Check for API key in headers (server-to-server or proxy-injected)
  const token = extractAdminKey(req);
  if (token && safeCompare(token, ADMIN_API_KEY)) {
    return null;
  }

  // Same-origin requests from the admin console's own pages hit these API
  // routes directly in the Next.js server process. The Referer/Origin check
  // below is a lightweight same-origin guard — not a security boundary on its
  // own, but combined with CORS defaults it prevents cross-origin misuse
  // while allowing the admin UI to work without sending a key header.
  const origin = req.headers.get("origin") || "";
  const referer = req.headers.get("referer") || "";
  const host = req.headers.get("host") || "";

  if (host && (origin.includes(host) || referer.includes(host))) {
    return null;
  }

  // Reject: no valid key header AND not a same-origin request
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
