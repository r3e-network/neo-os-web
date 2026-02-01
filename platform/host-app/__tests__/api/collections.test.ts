/**
 * Collections API Tests
 * Updated to test new security features (Auth0, CSRF, rate limiting)
 */

import { createMocks } from "node-mocks-http";
import handler from "@/pages/api/collections/index";

// Mock Auth0
jest.mock("@auth0/nextjs-auth0", () => ({
  getSession: jest.fn(),
}));

// Mock CSRF validation
jest.mock("@/lib/csrf", () => ({
  validateCsrfToken: jest.fn(() => true),
}));

// Mock rate limiter
jest.mock("@/lib/security/ratelimit", () => ({
  apiRateLimiter: {
    check: jest.fn(() => ({ allowed: true, remaining: 99 })),
  },
}));

// Mock Supabase with proper chaining
const mockSingle = jest.fn(() =>
  Promise.resolve({ data: { address: "NXYpGhqBbHCpvTnHT8gSCNL6KNjPH8hm1g" }, error: null }),
);
const mockOrder = jest.fn(() =>
  Promise.resolve({ data: [{ app_id: "miniapp-lottery", created_at: "2024-01-01" }], error: null }),
);
const mockEqChain = jest.fn(() => ({
  eq: jest.fn(() => ({ single: mockSingle })),
  single: mockSingle,
  order: mockOrder,
}));

jest.mock("@/lib/supabase", () => ({
  supabaseAdmin: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: mockEqChain,
      })),
      insert: jest.fn(() => Promise.resolve({ error: null })),
    })),
  },
  isSupabaseConfigured: true,
}));

import { getSession } from "@auth0/nextjs-auth0";
import { validateCsrfToken } from "@/lib/csrf";
import { apiRateLimiter } from "@/lib/security/ratelimit";

const mockGetSession = getSession as jest.Mock;
const mockValidateCsrf = validateCsrfToken as jest.Mock;
const mockRateLimiter = apiRateLimiter.check as jest.Mock;

// Valid Neo address format
const VALID_WALLET = "NXYpGhqBbHCpvTnHT8gSCNL6KNjPH8hm1g";

describe("/api/collections", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSession.mockResolvedValue({ user: { sub: "auth0|123" } });
    mockValidateCsrf.mockReturnValue(true);
    mockRateLimiter.mockReturnValue({ allowed: true, remaining: 99 });
  });

  describe("Authentication", () => {
    it("should return 401 without Auth0 session", async () => {
      mockGetSession.mockResolvedValue(null);
      const { req, res } = createMocks({
        method: "GET",
        headers: { "x-wallet-address": VALID_WALLET },
      });
      await handler(req, res);
      expect(res._getStatusCode()).toBe(401);
    });
  });

  describe("Rate Limiting", () => {
    it("should return 429 when rate limited", async () => {
      mockRateLimiter.mockReturnValue({ allowed: false, remaining: 0 });
      const { req, res } = createMocks({
        method: "GET",
        headers: { "x-wallet-address": VALID_WALLET },
      });
      await handler(req, res);
      expect(res._getStatusCode()).toBe(429);
    });
  });

  describe("Wallet Validation", () => {
    it("should return 400 without wallet address", async () => {
      const { req, res } = createMocks({ method: "GET" });
      await handler(req, res);
      expect(res._getStatusCode()).toBe(400);
    });

    it("should return 400 for invalid wallet format", async () => {
      const { req, res } = createMocks({
        method: "GET",
        headers: { "x-wallet-address": "invalid-address" },
      });
      await handler(req, res);
      expect(res._getStatusCode()).toBe(400);
    });
  });

  describe("CSRF Protection", () => {
    it("should return 403 for POST without valid CSRF token", async () => {
      mockValidateCsrf.mockReturnValue(false);
      const { req, res } = createMocks({
        method: "POST",
        headers: { "x-wallet-address": VALID_WALLET },
        body: { appId: "miniapp-coinflip" },
      });
      await handler(req, res);
      expect(res._getStatusCode()).toBe(403);
    });
  });

  describe("GET /api/collections", () => {
    it("should return collections for authenticated user", async () => {
      const { req, res } = createMocks({
        method: "GET",
        headers: { "x-wallet-address": VALID_WALLET },
      });
      await handler(req, res);
      expect(res._getStatusCode()).toBe(200);
    });
  });

  describe("POST /api/collections", () => {
    it("should add collection for authenticated user", async () => {
      const { req, res } = createMocks({
        method: "POST",
        headers: { "x-wallet-address": VALID_WALLET },
        body: { appId: "miniapp-coinflip" },
      });
      await handler(req, res);
      expect(res._getStatusCode()).toBe(201);
    });

    it("should return 400 for POST without appId", async () => {
      const { req, res } = createMocks({
        method: "POST",
        headers: { "x-wallet-address": VALID_WALLET },
        body: {},
      });
      await handler(req, res);
      expect(res._getStatusCode()).toBe(400);
    });
  });

  describe("Method Validation", () => {
    it("should return 405 for unsupported method", async () => {
      const { req, res } = createMocks({
        method: "PUT",
        headers: { "x-wallet-address": VALID_WALLET },
      });
      await handler(req, res);
      expect(res._getStatusCode()).toBe(405);
    });
  });
});
