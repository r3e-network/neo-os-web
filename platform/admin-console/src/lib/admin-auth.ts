import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";

/**
 * Server-only admin authentication.
 *
 * ALL requests to admin API routes must include a valid API key via
 * `X-Admin-Key` header or `Authorization: Bearer <key>`.
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
 * ALL callers must provide the API key via `X-Admin-Key` or
 * `Authorization: Bearer`. When the key env var is not set, requests
 * are rejected (fail closed).
 *
 * Returns null on success, or an error Response to short-circuit the handler.
 */
export function requireAdminAuth(req: Request): Response | null {
  if (isRateLimited(req)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  // Fail closed: when no API key is configured, reject all requests.
  // ADMIN_CONSOLE_API_KEY must be set in production AND development.
  if (!ADMIN_API_KEY) {
    return NextResponse.json(
      { error: "ADMIN_CONSOLE_API_KEY not configured" },
      { status: 500 },
    );
  }

  // Require a valid API key header for ALL requests (server-to-server,
  // proxy-injected, or same-origin browser requests via fetch).
  const token = extractAdminKey(req);
  if (token && safeCompare(token, ADMIN_API_KEY)) {
    return null;
  }

  // Reject: no valid key header
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
