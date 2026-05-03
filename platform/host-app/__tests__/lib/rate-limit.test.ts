import { createMocks } from "node-mocks-http";
import type { NextApiRequest, NextApiResponse } from "next";
import { defaultRateLimitKey, rateLimit } from "@/lib/rate-limit";

function mockRequest(url: string) {
  return createMocks<NextApiRequest, NextApiResponse>({
    method: "GET",
    url,
    headers: {
      "x-forwarded-for": "203.0.113.10",
    },
  });
}

describe("defaultRateLimitKey", () => {
  it("separates buckets by API path while ignoring query churn", () => {
    expect(defaultRateLimitKey(mockRequest("/api/miniapps/catalog?page=1").req)).toBe(
      "203.0.113.10:/api/miniapps/catalog",
    );
    expect(defaultRateLimitKey(mockRequest("/api/miniapps/catalog?page=2").req)).toBe(
      "203.0.113.10:/api/miniapps/catalog",
    );
    expect(defaultRateLimitKey(mockRequest("/api/gamification/leaderboard?limit=20").req)).toBe(
      "203.0.113.10:/api/gamification/leaderboard",
    );
  });
});

describe("rateLimit", () => {
  it("does not let one API path exhaust another path for the same client", () => {
    const limiter = rateLimit({ max: 2, windowMs: 60_000 });

    for (let i = 0; i < 2; i += 1) {
      const { req, res } = mockRequest("/api/miniapps/catalog");
      expect(limiter(req, res)).toBe(false);
    }

    const exhausted = mockRequest("/api/miniapps/catalog");
    expect(limiter(exhausted.req, exhausted.res)).toBe(true);
    expect(exhausted.res._getStatusCode()).toBe(429);

    const otherPath = mockRequest("/api/gamification/leaderboard");
    expect(limiter(otherPath.req, otherPath.res)).toBe(false);
    expect(otherPath.res._getStatusCode()).toBe(200);
  });
});
