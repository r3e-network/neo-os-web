/**
 * @jest-environment node
 */
import { createMocks } from "node-mocks-http";

jest.mock("@/lib/builtin-apps", () => ({
  getBuiltinApp: jest.fn((id: string) => {
    if (id === "builtin-app") {
      return {
        app_id: "builtin-app",
        name: "Builtin App",
        description: "A builtin app",
        category: "defi",
        source: "builtin",
      };
    }
    return null;
  }),
}));

jest.mock("@/lib/community-apps", () => ({
  fetchCommunityAppById: jest.fn(async (id: string) => {
    if (id === "community-app") {
      return {
        app_id: "community-app",
        name: "Community App",
        description: "A community app",
        category: "games",
        source: "community",
      };
    }
    return null;
  }),
}));

import handler from "@/pages/api/miniapps/[appId]/detail";

describe("GET /api/miniapps/[appId]/detail", () => {
  it("rejects non-GET methods", async () => {
    const { req, res } = createMocks({ method: "POST" });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(405);
  });

  it("returns 400 when appId is missing", async () => {
    const { req, res } = createMocks({ method: "GET", query: {} });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(400);
  });

  it("returns builtin app", async () => {
    const { req, res } = createMocks({
      method: "GET",
      query: { appId: "builtin-app" },
    });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(200);
    const body = JSON.parse(res._getData());
    expect(body.app.app_id).toBe("builtin-app");
    expect(body.app.source).toBe("builtin");
  });

  it("returns community app when not builtin", async () => {
    const { req, res } = createMocks({
      method: "GET",
      query: { appId: "community-app" },
    });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(200);
    const body = JSON.parse(res._getData());
    expect(body.app.app_id).toBe("community-app");
  });

  it("returns 404 when app not found", async () => {
    const { req, res } = createMocks({
      method: "GET",
      query: { appId: "nonexistent" },
    });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(404);
  });
});
