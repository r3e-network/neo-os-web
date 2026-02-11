/**
 * @jest-environment node
 */
import { createMocks } from "node-mocks-http";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockSupabaseAdmin = { from: jest.fn() };

jest.mock("@/lib/supabase", () => ({
  supabaseAdmin: mockSupabaseAdmin,
}));

const mockRequireWalletAuth = jest.fn();
jest.mock("@/lib/security/wallet-auth", () => ({
  requireWalletAuth: (...args: unknown[]) => mockRequireWalletAuth(...args),
}));

const mockRequireAdmin = jest.fn();
jest.mock("@/lib/admin-auth", () => ({
  requireAdmin: (...args: unknown[]) => mockRequireAdmin(...args),
}));

jest.mock("@/lib/security/ratelimit", () => ({
  apiRateLimiter: { check: jest.fn(() => ({ allowed: true, remaining: 99 })), windowSec: 60 },
  writeRateLimiter: { check: jest.fn(() => ({ allowed: true, remaining: 19 })), windowSec: 60 },
  authRateLimiter: { check: jest.fn(() => ({ allowed: true, remaining: 9 })), windowSec: 60 },
}));

import { createHandler } from "@/lib/api/create-handler";
import { apiRateLimiter } from "@/lib/security/ratelimit";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockWalletAuthSuccess(address = "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs") {
  mockRequireWalletAuth.mockReturnValue({ ok: true, address });
}

function mockWalletAuthFailure(status = 401, error = "Unauthorized") {
  mockRequireWalletAuth.mockReturnValue({ ok: false, status, error });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("createHandler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("503 — database not configured", () => {
    it("returns 503 when supabaseAdmin is null", async () => {
      // Temporarily override the mock
      const mod = jest.requireMock("@/lib/supabase") as { supabaseAdmin: unknown };
      const original = mod.supabaseAdmin;
      mod.supabaseAdmin = null;

      const handler = createHandler({
        auth: "none",
        methods: { GET: jest.fn() },
      });

      const { req, res } = createMocks({ method: "GET" });
      await handler(req, res);

      expect(res._getStatusCode()).toBe(503);
      expect(JSON.parse(res._getData())).toEqual({ error: "Database not configured" });

      mod.supabaseAdmin = original;
    });
  });

  describe("405 — method not allowed", () => {
    it("returns 405 with Allow header for unsupported method", async () => {
      const handler = createHandler({
        auth: "none",
        rateLimit: false,
        methods: { GET: jest.fn(), POST: jest.fn() },
      });

      const { req, res } = createMocks({ method: "DELETE" });
      await handler(req, res);

      expect(res._getStatusCode()).toBe(405);
      expect(res.getHeader("Allow")).toBe("GET, POST");
    });
  });

  describe("401 — wallet auth failure", () => {
    it("returns auth error status and message", async () => {
      mockWalletAuthFailure(401, "Missing wallet authentication headers");

      const handler = createHandler({
        auth: "wallet",
        rateLimit: false,
        methods: { GET: jest.fn() },
      });

      const { req, res } = createMocks({ method: "GET" });
      await handler(req, res);

      expect(res._getStatusCode()).toBe(401);
      expect(JSON.parse(res._getData()).error).toBe("Missing wallet authentication headers");
    });
  });

  describe("401 — admin auth failure", () => {
    it("returns 401 when admin auth fails", async () => {
      mockRequireAdmin.mockReturnValue({ ok: false, status: 401, error: "Unauthorized" });

      const handler = createHandler({
        auth: "admin",
        rateLimit: false,
        methods: { GET: jest.fn() },
      });

      const { req, res } = createMocks({ method: "GET" });
      await handler(req, res);

      expect(res._getStatusCode()).toBe(401);
    });
  });

  describe("401 — cron auth failure", () => {
    it("returns 401 when cron secret does not match", async () => {
      process.env.CRON_SECRET = "test-cron-secret-1234567890";

      const handler = createHandler({
        auth: "cron",
        rateLimit: false,
        methods: { POST: jest.fn() },
      });

      const { req, res } = createMocks({
        method: "POST",
        headers: { authorization: "Bearer wrong-secret" },
      });
      await handler(req, res);

      expect(res._getStatusCode()).toBe(401);
      delete process.env.CRON_SECRET;
    });

    it("returns 500 when CRON_SECRET is not configured", async () => {
      delete process.env.CRON_SECRET;

      const handler = createHandler({
        auth: "cron",
        rateLimit: false,
        methods: { POST: jest.fn() },
      });

      const { req, res } = createMocks({ method: "POST" });
      await handler(req, res);

      expect(res._getStatusCode()).toBe(500);
      expect(JSON.parse(res._getData()).error).toBe("Cron authentication not configured");
    });
  });

  describe("400 — Zod validation failure", () => {
    it("returns 400 with field errors on invalid body", async () => {
      mockWalletAuthSuccess();

      const schema = z.object({ name: z.string().min(1) });
      const handler = createHandler({
        auth: "wallet",
        rateLimit: false,
        methods: {
          POST: { handler: jest.fn(), schema },
        },
      });

      const { req, res } = createMocks({ method: "POST", body: { name: "" } });
      await handler(req, res);

      expect(res._getStatusCode()).toBe(400);
      const data = JSON.parse(res._getData());
      expect(data.error).toBe("Validation failed");
      expect(data.details).toBeDefined();
    });

    it("validates req.query for GET methods", async () => {
      mockWalletAuthSuccess();

      const schema = z.object({ page: z.coerce.number().int().min(1) });
      const handler = createHandler({
        auth: "wallet",
        rateLimit: false,
        methods: {
          GET: { handler: jest.fn(), schema },
        },
      });

      const { req, res } = createMocks({ method: "GET", query: { page: "0" } });
      await handler(req, res);

      expect(res._getStatusCode()).toBe(400);
    });
  });

  describe("200 — success path", () => {
    it("calls handler with ctx.db and ctx.address for wallet auth", async () => {
      const address = "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs";
      mockWalletAuthSuccess(address);

      const methodHandler = jest.fn((req, res, ctx) => {
        res.status(200).json({ address: ctx.address, hasDb: !!ctx.db });
      });

      const handler = createHandler({
        auth: "wallet",
        rateLimit: false,
        methods: { GET: methodHandler },
      });

      const { req, res } = createMocks({ method: "GET" });
      await handler(req, res);

      expect(res._getStatusCode()).toBe(200);
      const data = JSON.parse(res._getData());
      expect(data.address).toBe(address);
      expect(data.hasDb).toBe(true);
      expect(methodHandler).toHaveBeenCalledTimes(1);
    });

    it("skips auth for auth: none", async () => {
      const methodHandler = jest.fn((req, res) => {
        res.status(200).json({ ok: true });
      });

      const handler = createHandler({
        auth: "none",
        rateLimit: false,
        methods: { GET: methodHandler },
      });

      const { req, res } = createMocks({ method: "GET" });
      await handler(req, res);

      expect(res._getStatusCode()).toBe(200);
      expect(mockRequireWalletAuth).not.toHaveBeenCalled();
      expect(mockRequireAdmin).not.toHaveBeenCalled();
    });

    it("passes cron auth with correct secret", async () => {
      process.env.CRON_SECRET = "test-cron-secret-1234567890";

      const methodHandler = jest.fn((req, res) => {
        res.status(200).json({ ok: true });
      });

      const handler = createHandler({
        auth: "cron",
        rateLimit: false,
        methods: { POST: methodHandler },
      });

      const { req, res } = createMocks({
        method: "POST",
        headers: { authorization: "Bearer test-cron-secret-1234567890" },
      });
      await handler(req, res);

      expect(res._getStatusCode()).toBe(200);
      expect(methodHandler).toHaveBeenCalledTimes(1);
      delete process.env.CRON_SECRET;
    });
  });

  describe("429 — rate limiting", () => {
    it("returns 429 when rate limit is exceeded", async () => {
      (apiRateLimiter.check as jest.Mock).mockReturnValueOnce({ allowed: false, remaining: 0 });

      const handler = createHandler({
        auth: "none",
        rateLimit: "api",
        methods: { GET: jest.fn() },
      });

      const { req, res } = createMocks({ method: "GET" });
      await handler(req, res);

      expect(res._getStatusCode()).toBe(429);
      expect(res.getHeader("Retry-After")).toBe("60");
    });
  });

  describe("500 — unhandled error", () => {
    it("catches handler exceptions and returns 500", async () => {
      mockWalletAuthSuccess();
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();

      const handler = createHandler({
        auth: "wallet",
        rateLimit: false,
        methods: {
          GET: () => {
            throw new Error("boom");
          },
        },
      });

      const { req, res } = createMocks({ method: "GET" });
      await handler(req, res);

      expect(res._getStatusCode()).toBe(500);
      expect(JSON.parse(res._getData()).error).toBe("Internal server error");
      consoleSpy.mockRestore();
    });
  });
});
