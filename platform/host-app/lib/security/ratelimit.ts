/**
 * Simple in-memory rate limiter with automatic cleanup
 */

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
