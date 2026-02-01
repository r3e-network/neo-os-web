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
      limit: jest.fn().mockResolvedValue({ data: [], error: null }),
      insert: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: { id: 1 }, error: null }),
    })),
  },
  isSupabaseConfigured: true,
}));

import handler from "@/pages/api/messaging/index";

describe("Messaging API", () => {
  it("returns 400 if appId is missing for GET", async () => {
    const { req, res } = createMocks({ method: "GET", query: {} });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(400);
  });

  it("returns 405 for unsupported methods", async () => {
    const { req, res } = createMocks({ method: "DELETE" });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(405);
  });
});
