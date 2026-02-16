import type { NextApiRequest, NextApiResponse } from "next";
import { apiError } from "@/lib/api-response";
import { logger } from "@/lib/logger";

type RateLimitConfig = {
  windowMs?: number;
  max?: number;
  keyGenerator?: (req: NextApiRequest) => string;
};

interface SlidingWindowEntry {
  timestamps: number[];
}

const CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes

function getClientIp(req: NextApiRequest): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    const first = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(",")[0];
    return first.trim();
  }
  const realIp = req.headers["x-real-ip"];
  if (realIp) {
    return Array.isArray(realIp) ? realIp[0] : realIp;
  }
  return req.socket.remoteAddress ?? "unknown";
}

export function rateLimit(config?: RateLimitConfig) {
  const windowMs = config?.windowMs ?? 60_000;
  const max = config?.max ?? 60;
  const keyGenerator = config?.keyGenerator ?? getClientIp;

  const store = new Map<string, SlidingWindowEntry>();

  // Periodic cleanup of expired entries
  const cleanup = setInterval(() => {
    const now = Date.now();
    const cutoff = now - windowMs;
    for (const [key, entry] of store) {
      entry.timestamps = entry.timestamps.filter((t) => t > cutoff);
      if (entry.timestamps.length === 0) {
        store.delete(key);
      }
    }
    logger.debug(`rate-limit cleanup: ${store.size} keys remaining`);
  }, CLEANUP_INTERVAL);

  // Allow GC if the process doesn't need this timer
  if (cleanup.unref) {
    cleanup.unref();
  }

  return function check(req: NextApiRequest, res: NextApiResponse): boolean {
    const key = keyGenerator(req);
    const now = Date.now();
    const cutoff = now - windowMs;

    let entry = store.get(key);
    if (!entry) {
      entry = { timestamps: [] };
      store.set(key, entry);
    }

    // Slide the window: drop expired timestamps
    entry.timestamps = entry.timestamps.filter((t) => t > cutoff);

    const remaining = Math.max(0, max - entry.timestamps.length);
    const resetAt = entry.timestamps.length > 0
      ? Math.ceil((entry.timestamps[0] + windowMs) / 1000)
      : Math.ceil((now + windowMs) / 1000);

    res.setHeader("X-RateLimit-Limit", max);
    res.setHeader("X-RateLimit-Remaining", remaining);
    res.setHeader("X-RateLimit-Reset", resetAt);

    if (entry.timestamps.length >= max) {
      const retryAfterSec = Math.ceil((entry.timestamps[0] + windowMs - now) / 1000);
      res.setHeader("Retry-After", Math.max(1, retryAfterSec));
      logger.warn(`rate-limit hit for key=${key}, limit=${max}, window=${windowMs}ms`);
      apiError.rateLimited(res, "rate limit exceeded");
      return true;
    }

    entry.timestamps.push(now);
    // Update remaining after recording this request
    res.setHeader("X-RateLimit-Remaining", Math.max(0, max - entry.timestamps.length));
    return false;
  };
}

// Pre-configured limiters
export const strictLimit = rateLimit({ max: 10, windowMs: 60_000 });
export const standardLimit = rateLimit({ max: 60, windowMs: 60_000 });
export const relaxedLimit = rateLimit({ max: 200, windowMs: 60_000 });
