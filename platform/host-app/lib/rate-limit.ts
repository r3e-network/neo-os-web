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
const MAX_STORE_SIZE = 50_000;

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

function getRequestPath(req: NextApiRequest): string {
  if (!req.url) return "unknown";

  try {
    return new URL(req.url, "http://internal").pathname;
  } catch {
    return req.url.split("?")[0] || "unknown";
  }
}

export function defaultRateLimitKey(req: NextApiRequest): string {
  return `${getClientIp(req)}:${getRequestPath(req)}`;
}

export function rateLimit(config?: RateLimitConfig) {
  const windowMs = config?.windowMs ?? 60_000;
  const max = config?.max ?? 60;
  const keyGenerator = config?.keyGenerator ?? defaultRateLimitKey;

  const store = new Map<string, SlidingWindowEntry>();

  // Track if cleanup has been called
  let isCleanedUp = false;

  // Periodic cleanup of expired entries
  const cleanup = setInterval(() => {
    if (isCleanedUp) return;
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

  // Cleanup function to clear the interval
  const destroy = () => {
    isCleanedUp = true;
    clearInterval(cleanup);
  };

  return function check(req: NextApiRequest, res: NextApiResponse): boolean {
    if (process.env.PLAYWRIGHT === "1") {
      res.setHeader("X-RateLimit-Limit", "unlimited");
      res.setHeader("X-RateLimit-Remaining", "unlimited");
      res.setHeader("X-RateLimit-Reset", Math.ceil((Date.now() + windowMs) / 1000));
      return false;
    }

    const key = keyGenerator(req);
    const now = Date.now();
    const cutoff = now - windowMs;

    let entry = store.get(key);
    if (!entry) {
      if (store.size >= MAX_STORE_SIZE) {
        const oldest = store.keys().next().value;
        if (oldest !== undefined) store.delete(oldest);
      }
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

    // Attach destroy to res for cleanup
    (res as NextApiResponse & { destroyRateLimit?: () => void }).destroyRateLimit = destroy;

    return false;
  };
}

// Pre-configured limiters
export const strictLimit = rateLimit({ max: 10, windowMs: 60_000 });
export const standardLimit = rateLimit({ max: 60, windowMs: 60_000 });
export const relaxedLimit = rateLimit({ max: 200, windowMs: 60_000 });
