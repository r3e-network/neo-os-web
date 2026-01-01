/**
 * @jest-environment node
 */
import { apiRateLimiter } from "@/lib/security/ratelimit";

describe("Rate Limiter", () => {
  it("allows requests within limit", () => {
    const result = apiRateLimiter.check("test-key-1");
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBeGreaterThan(0);
  });

  it("tracks remaining requests", () => {
    const first = apiRateLimiter.check("test-key-2");
    const second = apiRateLimiter.check("test-key-2");
    expect(second.remaining).toBeLessThan(first.remaining);
  });
});
