/**
 * @jest-environment node
 */
import { createMocks } from "node-mocks-http";

jest.mock("@/lib/supabase", () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
    })),
  },
  isSupabaseConfigured: true,
}));

import handler from "@/pages/api/versions/[appId]";

describe("Versions API", () => {
  it("returns 400 if appId is missing", async () => {
    const { req, res } = createMocks({ method: "GET", query: {} });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(400);
  });

  it("returns 405 for unsupported methods", async () => {
    const { req, res } = createMocks({
      method: "DELETE",
      query: { appId: "test-app" },
    });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(405);
  });
});
