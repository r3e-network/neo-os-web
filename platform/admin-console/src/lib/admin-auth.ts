import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";

/**
 * Server-only admin API key. MUST NOT be prefixed with NEXT_PUBLIC_ — doing so
 * would expose the secret to browsers. Browser clients authenticate via session
 * cookies; only server-to-server callers use this key directly.
 */
const ADMIN_API_KEY = String(process.env.ADMIN_CONSOLE_API_KEY || process.env.ADMIN_API_KEY || "").trim();
const ADMIN_SESSION_SECRET = String(process.env.NEXTAUTH_SECRET || process.env.ADMIN_SESSION_SECRET || "").trim();
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
 * Validate a session cookie from a browser-based admin request.
 *
 * The session token is an HMAC-SHA256 of "admin-session" keyed by
 * NEXTAUTH_SECRET / ADMIN_SESSION_SECRET. This is a minimal implementation;
 * production deployments should integrate a full session store (e.g. NextAuth,
 * iron-session, or a database-backed session).
 */
function validateAdminSession(req: Request): boolean {
  if (!ADMIN_SESSION_SECRET) return false;

  const cookieHeader = req.headers.get("cookie") || "";
  const match = cookieHeader.match(/(?:^|;\s*)admin_session=([^;]+)/);
  if (!match) return false;

  const sessionToken = decodeURIComponent(match[1]).trim();
  if (!sessionToken) return false;

  // Compute expected HMAC so we can do a timing-safe comparison
  const { createHmac } = require("crypto") as typeof import("crypto");
  const expected = createHmac("sha256", ADMIN_SESSION_SECRET)
    .update("admin-session")
    .digest("hex");

  return safeCompare(sessionToken, expected);
}

/**
 * Authenticate an incoming admin API request.
 *
 * Accepts either:
 *  1. A valid session cookie (browser clients) — preferred path.
 *  2. An X-Admin-Key / Authorization: Bearer header (server-to-server only).
 *
 * Returns null on success, or an error Response to short-circuit the handler.
 */
export function requireAdminAuth(req: Request): Response | null {
  if (isRateLimited(req)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  // Path 1: session cookie (browser clients)
  if (validateAdminSession(req)) {
    return null;
  }

  // Path 2: API key header (server-to-server calls)
  if (!ADMIN_API_KEY) {
    return NextResponse.json({ error: "Admin API key not configured" }, { status: 500 });
  }

  const token = extractAdminKey(req);
  if (!token || !safeCompare(token, ADMIN_API_KEY)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}
