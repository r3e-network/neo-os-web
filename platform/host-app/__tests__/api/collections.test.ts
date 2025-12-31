/**
 * Collections API Tests
 */

import { createMocks } from "node-mocks-http";
import handler from "@/pages/api/collections/index";

jest.mock("@/lib/supabase", () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          order: jest.fn(() =>
            Promise.resolve({ data: [{ app_id: "miniapp-lottery", created_at: "2024-01-01" }], error: null }),
          ),
        })),
      })),
      insert: jest.fn(() => Promise.resolve({ error: null })),
    })),
  },
  isSupabaseConfigured: true,
}));

describe("/api/collections", () => {
  it("should return 401 without wallet address", async () => {
    const { req, res } = createMocks({ method: "GET" });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(401);
  });

  it("should return collections for GET", async () => {
    const { req, res } = createMocks({
      method: "GET",
      headers: { "x-wallet-address": "NeoAddress123" },
    });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(200);
  });

  it("should add collection for POST", async () => {
    const { req, res } = createMocks({
      method: "POST",
      headers: { "x-wallet-address": "NeoAddress123" },
      body: { appId: "miniapp-coinflip" },
    });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(201);
  });

  it("should return 400 for POST without appId", async () => {
    const { req, res } = createMocks({
      method: "POST",
      headers: { "x-wallet-address": "NeoAddress123" },
      body: {},
    });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(400);
  });

  it("should return 405 for unsupported method", async () => {
    const { req, res } = createMocks({
      method: "PUT",
      headers: { "x-wallet-address": "NeoAddress123" },
    });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(405);
  });
});
