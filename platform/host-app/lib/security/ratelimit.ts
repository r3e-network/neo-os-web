/**
 * Simple in-memory rate limiter with automatic cleanup.
 *
 * ⚠️  PRODUCTION NOTE: This in-memory implementation uses a per-process Map.
 * In serverless environments (Vercel, AWS Lambda) each cold start creates a
 * fresh Map, making the limiter ineffective across invocations.
 *
 * For production deployments, replace with a distributed store:
 *   - Upstash Redis  (@upstash/ratelimit)
 *   - Vercel KV
 *   - Redis via ioredis
 *
 * The current implementation is suitable for long-lived Node.js processes
 * (e.g. `next start` on a VM or container).
 */

import type { NextApiRequest, NextApiResponse } from "next";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

class RateLimiter {
  private limits = new Map<string, RateLimitEntry>();
  private maxRequests: number;
  private windowMs: number;
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor(maxRequests = 100, windowMs = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    // Cleanup expired entries every 5 minutes to prevent memory leaks
    this.startCleanup();
  }

  private startCleanup(): void {
    // Only start cleanup in browser/Node environment
    if (typeof setInterval !== "undefined") {
      this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
    }
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.limits) {
      if (now > entry.resetAt) {
        this.limits.delete(key);
      }
    }
  }

  check(key: string): { allowed: boolean; remaining: number } {
    const now = Date.now();
    const entry = this.limits.get(key);

    if (!entry || now > entry.resetAt) {
      this.limits.set(key, { count: 1, resetAt: now + this.windowMs });
      return { allowed: true, remaining: this.maxRequests - 1 };
    }

    if (entry.count >= this.maxRequests) {
      return { allowed: false, remaining: 0 };
    }

    entry.count++;
    return { allowed: true, remaining: this.maxRequests - entry.count };
  }

  /** Window duration in seconds (for Retry-After header) */
  get windowSec(): number {
    return Math.ceil(this.windowMs / 1000);
  }

  // For testing or graceful shutdown
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.limits.clear();
  }
}

export const apiRateLimiter = new RateLimiter(100, 60000);
export const authRateLimiter = new RateLimiter(10, 60000);
export const writeRateLimiter = new RateLimiter(20, 60000);

// ---------------------------------------------------------------------------
// Next.js API middleware helper
// ---------------------------------------------------------------------------

type NextApiHandler = (req: NextApiRequest, res: NextApiResponse) => Promise<void> | void;

/**
 * Extract a stable client identifier from the request.
 * Prefers x-forwarded-for (behind reverse proxy), falls back to socket address.
 */
function getClientKey(req: NextApiRequest): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") return forwarded.split(",")[0].trim();
  return req.socket?.remoteAddress ?? "unknown";
}

/**
 * Wrap a Next.js API handler with rate limiting.
 *
 * Usage:
 *   export default withRateLimit(apiRateLimiter, handler);
 */
export function withRateLimit(limiter: RateLimiter, handler: NextApiHandler): NextApiHandler {
  return async (req, res) => {
    const key = getClientKey(req);
    const { allowed, remaining } = limiter.check(key);

    res.setHeader("X-RateLimit-Remaining", String(remaining));

    if (!allowed) {
      res.setHeader("Retry-After", String(limiter.windowSec));
      return res.status(429).json({ error: "Too many requests" });
    }

    return handler(req, res);
  };
}
