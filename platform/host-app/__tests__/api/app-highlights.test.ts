/**
 * App Highlights API Tests
 */

import { createMocks } from "node-mocks-http";
import handler from "@/pages/api/app-highlights/[appId]";

// Mock fetch for stats API
global.fetch = jest.fn();

jest.mock("@/lib/neoburger", () => ({
  getNeoBurgerStats: jest.fn(() =>
    Promise.resolve({
      apr: "8.5",
      totalStakedFormatted: "12.5M",
    }),
  ),
}));

describe("/api/app-highlights/[appId]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock stats API response
    (global.fetch as jest.Mock).mockResolvedValue({
      json: () =>
        Promise.resolve({
          stats: [{ app_id: "miniapp-lottery", total_users: 150, total_transactions: 500, total_gas_used: "25.5" }],
        }),
    });
  });

  it("should return 405 for non-GET methods", async () => {
    const { req, res } = createMocks({ method: "POST" });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(405);
  });

  it("should return 400 without appId", async () => {
    const { req, res } = createMocks({ method: "GET", query: {} });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(400);
  });

  it("should return highlights for neoburger", async () => {
    const { req, res } = createMocks({
      method: "GET",
      query: { appId: "miniapp-neoburger" },
      headers: { host: "localhost:3000" },
    });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(200);
    const data = JSON.parse(res._getData());
    expect(data.highlights).toBeDefined();
    expect(data.highlights[0].label).toBe("APR");
  });

  it("should return real stats highlights for lottery", async () => {
    const { req, res } = createMocks({
      method: "GET",
      query: { appId: "miniapp-lottery" },
      headers: { host: "localhost:3000" },
    });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(200);
    const data = JSON.parse(res._getData());
    expect(data.highlights[0].label).toBe("Players");
    expect(data.highlights[0].value).toBe("150");
  });
});
