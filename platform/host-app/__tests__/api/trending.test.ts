import { createMocks } from "node-mocks-http";
import type { NextApiRequest, NextApiResponse } from "next";
import handler from "@/pages/api/miniapps/trending";

describe("/api/miniapps/trending", () => {
  it("returns 405 for non-GET requests", async () => {
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "POST",
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(405);
  });

  it("returns trending apps with default limit", async () => {
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    const data = JSON.parse(res._getData());
    expect(data.trending).toBeDefined();
    expect(data.trending.length).toBeLessThanOrEqual(10);
    expect(data.updated_at).toBeDefined();
  });

  it("respects limit parameter", async () => {
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
      query: { limit: "5" },
    });

    await handler(req, res);

    const data = JSON.parse(res._getData());
    expect(data.trending.length).toBeLessThanOrEqual(5);
  });

  it("filters by category", async () => {
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
      query: { category: "gaming" },
    });

    await handler(req, res);

    const data = JSON.parse(res._getData());
    data.trending.forEach((app: { category: string }) => {
      expect(app.category).toBe("gaming");
    });
  });

  it("returns apps with required fields", async () => {
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
      query: { limit: "1" },
    });

    await handler(req, res);

    const data = JSON.parse(res._getData());
    if (data.trending.length > 0) {
      const app = data.trending[0];
      expect(app.app_id).toBeDefined();
      expect(app.name).toBeDefined();
      expect(app.score).toBeDefined();
      expect(app.stats).toBeDefined();
    }
  });
});
