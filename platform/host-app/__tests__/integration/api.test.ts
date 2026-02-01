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
    })),
  },
  isSupabaseConfigured: true,
}));

import foldersHandler from "@/pages/api/folders/index";
import devStatsHandler from "@/pages/api/developer/stats";

describe("Integration Tests", () => {
  describe("Folders API", () => {
    it("GET returns folders", async () => {
      const { req, res } = createMocks({ method: "GET", query: { wallet: "NXtest" } });
      await foldersHandler(req, res);
      expect(res._getStatusCode()).toBe(200);
    });
  });

  describe("Developer Stats API", () => {
    it("GET returns stats", async () => {
      const { req, res } = createMocks({ method: "GET", query: { wallet: "NXtest" } });
      await devStatsHandler(req, res);
      expect(res._getStatusCode()).toBe(200);
    });
  });
});
