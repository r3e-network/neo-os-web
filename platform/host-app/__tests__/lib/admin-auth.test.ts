/**
 * @jest-environment node
 */

// Mock env module before importing admin-auth
const mockEnv: Record<string, string | undefined> = {};
jest.mock("@/lib/env", () => ({
  env: new Proxy(mockEnv, {
    get: (_target, prop: string) => mockEnv[prop],
  }),
}));

import { requireAdmin, getAdminKeyConfigured } from "@/lib/admin-auth";

describe("admin-auth", () => {
  const ADMIN_KEY = "test-admin-secret-key-12345";

  beforeEach(() => {
    // Clear all mock env values
    Object.keys(mockEnv).forEach((k) => delete mockEnv[k]);
    delete process.env.ADMIN_CONSOLE_API_KEY;
    delete process.env.ADMIN_API_KEY;
  });

  describe("requireAdmin", () => {
    it("returns 500 when no admin key is configured", () => {
      const result = requireAdmin({ authorization: `Bearer ${ADMIN_KEY}` });
      expect(result).toEqual({
        ok: false,
        status: 500,
        error: "Admin API key not configured",
      });
    });

    it("authenticates via env.ADMIN_CONSOLE_API_KEY", () => {
      mockEnv.ADMIN_CONSOLE_API_KEY = ADMIN_KEY;
      const result = requireAdmin({ authorization: `Bearer ${ADMIN_KEY}` });
      expect(result).toEqual({ ok: true });
    });

    it("authenticates via env.ADMIN_API_KEY fallback", () => {
      mockEnv.ADMIN_API_KEY = ADMIN_KEY;
      const result = requireAdmin({ authorization: `Bearer ${ADMIN_KEY}` });
      expect(result).toEqual({ ok: true });
    });

    it("authenticates via process.env fallback", () => {
      process.env.ADMIN_CONSOLE_API_KEY = ADMIN_KEY;
      const result = requireAdmin({ authorization: `Bearer ${ADMIN_KEY}` });
      expect(result).toEqual({ ok: true });
    });

    it("accepts x-admin-key header", () => {
      mockEnv.ADMIN_CONSOLE_API_KEY = ADMIN_KEY;
      const result = requireAdmin({ "x-admin-key": `Bearer ${ADMIN_KEY}` });
      expect(result).toEqual({ ok: true });
    });

    it("accepts x-admin-token header", () => {
      mockEnv.ADMIN_CONSOLE_API_KEY = ADMIN_KEY;
      const result = requireAdmin({ "x-admin-token": ADMIN_KEY });
      expect(result).toEqual({ ok: true });
    });

    it("rejects missing authorization header", () => {
      mockEnv.ADMIN_CONSOLE_API_KEY = ADMIN_KEY;
      const result = requireAdmin({});
      expect(result).toEqual({
        ok: false,
        status: 401,
        error: "Unauthorized",
      });
    });

    it("rejects wrong key", () => {
      mockEnv.ADMIN_CONSOLE_API_KEY = ADMIN_KEY;
      const result = requireAdmin({ authorization: "Bearer wrong-key" });
      expect(result).toEqual({
        ok: false,
        status: 401,
        error: "Unauthorized",
      });
    });

    it("handles array header values", () => {
      mockEnv.ADMIN_CONSOLE_API_KEY = ADMIN_KEY;
      const result = requireAdmin({
        authorization: [`Bearer ${ADMIN_KEY}`, "Bearer other"],
      });
      expect(result).toEqual({ ok: true });
    });
  });

  describe("getAdminKeyConfigured", () => {
    it("returns false when no key configured", () => {
      expect(getAdminKeyConfigured()).toBe(false);
    });

    it("returns true when key is configured", () => {
      mockEnv.ADMIN_CONSOLE_API_KEY = ADMIN_KEY;
      expect(getAdminKeyConfigured()).toBe(true);
    });
  });
});
