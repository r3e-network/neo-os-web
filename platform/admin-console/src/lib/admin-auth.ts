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
 * Rate limiting counts FAILED auth attempts per client IP. The client IP is
 * taken from the LAST x-forwarded-for hop, so the console must sit behind a
 * trusted reverse proxy that appends the real peer address to that header.
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
    // Proxies APPEND to x-forwarded-for, so only the LAST hop was written by
    // our own trusted proxy; earlier entries are client-controlled and would
    // let an attacker rotate keys (bypass) or spoof the operator's IP (lockout).
    const hops = forwarded.split(",").map((hop) => hop.trim()).filter(Boolean);
    const last = hops[hops.length - 1];
    if (last) return last;
  }

  const realIP = req.headers.get("x-real-ip") || "";
  if (realIP.trim()) return realIP.trim();

  return "unknown";
}

function isRateLimited(clientKey: string): boolean {
  const existing = authRateLimit.get(clientKey);
  if (!existing || Date.now() >= existing.resetAtUnixMS) return false;
  return existing.count >= ADMIN_AUTH_MAX_REQUESTS;
}

function recordAuthFailure(clientKey: string): void {
  const now = Date.now();
  const windowMS = ADMIN_AUTH_WINDOW_SECONDS * 1000;

  const existing = authRateLimit.get(clientKey);
  if (!existing || now >= existing.resetAtUnixMS) {
    authRateLimit.set(clientKey, {
      count: 1,
      resetAtUnixMS: now + windowMS,
    });
  } else {
    existing.count += 1;
  }

  if (authRateLimit.size > 10_000) {
    for (const [ip, entry] of authRateLimit.entries()) {
      if (now >= entry.resetAtUnixMS) {
        authRateLimit.delete(ip);
      }
    }
  }
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
  const clientKey = extractClientIP(req);
  if (isRateLimited(clientKey)) {
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
  // Successful auth never counts toward the limit: only FAILED attempts do,
  // so a brute-forcer trips the window while the operator cannot be locked
  // out of their own console by request volume alone.
  const token = extractAdminKey(req);
  if (token && safeCompare(token, ADMIN_API_KEY)) {
    return null;
  }

  // Reject: no valid key header
  recordAuthFailure(clientKey);
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
