/**
 * App Highlights API Tests
 */

import { createMocks } from "node-mocks-http";
import handler from "@/pages/api/app-highlights/[appId]";

jest.mock("@/lib/neoburger", () => ({
  getNeoBurgerStats: jest.fn(() =>
    Promise.resolve({
      apr: "8.5",
      totalStakedFormatted: "12.5M",
    }),
  ),
}));

jest.mock("@/lib/app-highlights", () => ({
  getAppHighlights: jest.fn((appId: string) => {
    if (appId === "miniapp-lottery") {
      return [{ label: "Jackpot", value: "100 GAS", icon: "💰" }];
    }
    return undefined;
  }),
}));

describe("/api/app-highlights/[appId]", () => {
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
    });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(200);
    const data = JSON.parse(res._getData());
    expect(data.highlights).toBeDefined();
    expect(data.highlights[0].label).toBe("APR");
  });

  it("should return static highlights for lottery", async () => {
    const { req, res } = createMocks({
      method: "GET",
      query: { appId: "miniapp-lottery" },
    });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(200);
    const data = JSON.parse(res._getData());
    expect(data.highlights[0].label).toBe("Jackpot");
  });
});
