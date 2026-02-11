/**
 * @jest-environment node
 */
import { createMocks } from "node-mocks-http";

jest.mock("@/lib/builtin-apps", () => ({
  BUILTIN_APPS: [
    {
      app_id: "app-1",
      name: "Test App",
      description: "A test app",
      category: "defi",
      status: "published",
      supportedChains: ["neo-n3-mainnet"],
    },
    {
      app_id: "app-2",
      name: "Game App",
      name_zh: "游戏应用",
      description: "A game",
      description_zh: "一个游戏",
      category: "games",
      status: "published",
    },
  ],
}));

import handler from "@/pages/api/miniapps/index";

describe("GET /api/miniapps", () => {
  it("returns apps grouped by category", async () => {
    const { req, res } = createMocks({ method: "GET", query: {} });
    handler(req, res);
    expect(res._getStatusCode()).toBe(200);
    const body = JSON.parse(res._getData());
    expect(body.defi).toHaveLength(1);
    expect(body.games).toHaveLength(1);
  });

  it("filters by category", async () => {
    const { req, res } = createMocks({
      method: "GET",
      query: { category: "defi" },
    });
    handler(req, res);
    expect(res._getStatusCode()).toBe(200);
    const body = JSON.parse(res._getData());
    expect(body.defi).toHaveLength(1);
    expect(body.games).toBeUndefined();
  });

  it("filters by search term", async () => {
    const { req, res } = createMocks({
      method: "GET",
      query: { search: "game" },
    });
    handler(req, res);
    expect(res._getStatusCode()).toBe(200);
    const body = JSON.parse(res._getData());
    expect(body.games).toHaveLength(1);
    expect(body.defi).toBeUndefined();
  });

  it("returns single app by appId", async () => {
    const { req, res } = createMocks({
      method: "GET",
      query: { appId: "app-1" },
    });
    handler(req, res);
    expect(res._getStatusCode()).toBe(200);
    const body = JSON.parse(res._getData());
    expect(body.manifest.app_id).toBe("app-1");
  });

  it("returns 404 for unknown appId", async () => {
    const { req, res } = createMocks({
      method: "GET",
      query: { appId: "nonexistent" },
    });
    handler(req, res);
    expect(res._getStatusCode()).toBe(404);
  });

  it("returns 405 for non-GET methods", async () => {
    const { req, res } = createMocks({ method: "POST" });
    handler(req, res);
    expect(res._getStatusCode()).toBe(405);
  });

  it("searches by Chinese name", async () => {
    const { req, res } = createMocks({
      method: "GET",
      query: { search: "游戏" },
    });
    handler(req, res);
    expect(res._getStatusCode()).toBe(200);
    const body = JSON.parse(res._getData());
    expect(body.games).toHaveLength(1);
  });
});
