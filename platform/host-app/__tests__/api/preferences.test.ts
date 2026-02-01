/**
 * @jest-environment node
 */
import { createMocks } from "node-mocks-http";

// Mock supabase
jest.mock("@/lib/supabase", () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: { code: "PGRST116" } }),
      upsert: jest.fn().mockReturnThis(),
    })),
  },
  isSupabaseConfigured: true,
}));

import handler from "@/pages/api/preferences/index";

describe("Preferences API", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 400 if wallet is missing", async () => {
    const { req, res } = createMocks({ method: "GET", query: {} });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(400);
  });

  it("returns defaults when no preferences exist", async () => {
    const { req, res } = createMocks({
      method: "GET",
      query: { wallet: "NXtest123" },
    });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(200);
    const data = JSON.parse(res._getData());
    expect(data.preferences.theme).toBe("system");
  });

  it("returns 405 for unsupported methods", async () => {
    const { req, res } = createMocks({
      method: "DELETE",
      query: { wallet: "NXtest123" },
    });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(405);
  });
});
