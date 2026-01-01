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
      limit: jest.fn().mockResolvedValue({ data: [] }),
    })),
  },
  isSupabaseConfigured: true,
}));

import handler from "@/pages/api/rankings/index";

describe("Rankings API", () => {
  it("returns rankings", async () => {
    const { req, res } = createMocks({ method: "GET", query: { type: "hot" } });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(200);
  });
});
