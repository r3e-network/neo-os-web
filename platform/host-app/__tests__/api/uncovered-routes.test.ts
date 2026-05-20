import { createMocks } from "node-mocks-http";
import type { NextApiRequest, NextApiResponse } from "next";

// Backfill tests for host-app API routes flagged as uncovered in the
// coverage audit. Focus on routes with stable, deterministic behavior
// that don't require live Supabase or external services.

describe("uncovered host-app API routes (coverage backfill)", () => {
  // -------------------------------------------------------------------------
  // /api/health
  // -------------------------------------------------------------------------
  describe("/api/health", () => {
    let handler: typeof import("@/pages/api/health").default;
    beforeAll(async () => {
      handler = (await import("@/pages/api/health")).default;
    });

    it("GET → 200 {status: 'ok'}", async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({ method: "GET" });
      handler(req, res);
      expect(res._getStatusCode()).toBe(200);
      expect(JSON.parse(res._getData())).toEqual({ status: "ok" });
    });

    it("HEAD → 200 empty body", async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({ method: "HEAD" });
      handler(req, res);
      expect(res._getStatusCode()).toBe(200);
    });

    it("POST → 405", async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({ method: "POST" });
      handler(req, res);
      expect(res._getStatusCode()).toBe(405);
    });
  });

  // -------------------------------------------------------------------------
  // /api/csrf-token
  // -------------------------------------------------------------------------
  describe("/api/csrf-token", () => {
    let handler: typeof import("@/pages/api/csrf-token").default;
    beforeAll(async () => {
      handler = (await import("@/pages/api/csrf-token")).default;
    });

    it("GET → 200 with csrfToken and sets cookie", async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({ method: "GET" });
      handler(req, res);
      expect(res._getStatusCode()).toBe(200);
      const body = JSON.parse(res._getData());
      expect(body.csrfToken).toBeTruthy();
      expect(typeof body.csrfToken).toBe("string");
      expect(body.csrfToken.length).toBeGreaterThan(16);
      // The token must also be set as a cookie for double-submit verification.
      const setCookie = res.getHeader("Set-Cookie");
      expect(setCookie).toBeTruthy();
    });

    it("POST → 405", async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({ method: "POST" });
      handler(req, res);
      expect(res._getStatusCode()).toBe(405);
    });

    it("two calls return distinct tokens", () => {
      const { req: req1, res: res1 } = createMocks<NextApiRequest, NextApiResponse>({ method: "GET" });
      handler(req1, res1);
      const { req: req2, res: res2 } = createMocks<NextApiRequest, NextApiResponse>({ method: "GET" });
      handler(req2, res2);
      const a = JSON.parse(res1._getData()).csrfToken;
      const b = JSON.parse(res2._getData()).csrfToken;
      expect(a).not.toEqual(b);
    });
  });
});
