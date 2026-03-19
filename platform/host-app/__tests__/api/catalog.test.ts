import { createMocks } from "node-mocks-http";
import type { NextApiRequest, NextApiResponse } from "next";
import path from "path";
import handler from "@/pages/api/miniapps/catalog";

describe("/api/miniapps/catalog", () => {
  const previousDefinitionsDir = process.env.MINIAPP_DEFINITIONS_DIR;
  const previousCatalogSource = process.env.MINIAPP_CATALOG_SOURCE;

  beforeAll(() => {
    process.env.MINIAPP_DEFINITIONS_DIR = path.resolve(process.cwd(), "public", "miniapp-definitions");
    process.env.MINIAPP_CATALOG_SOURCE = "local";
  });

  afterAll(() => {
    process.env.MINIAPP_DEFINITIONS_DIR = previousDefinitionsDir;
    process.env.MINIAPP_CATALOG_SOURCE = previousCatalogSource;
  });

  it("returns 405 for non-GET requests", async () => {
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "POST",
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(405);
    expect(JSON.parse(res._getData())).toEqual({ error: { code: "METHOD_NOT_ALLOWED", message: "method not allowed" } });
  });

  it("returns active catalog by default", async () => {
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    const data = JSON.parse(res._getData());
    expect(Array.isArray(data.apps)).toBe(true);
    expect(data.apps.length).toBeGreaterThan(0);
  });

  it("does not include static miniapps for pending catalog", async () => {
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
      query: { status: "pending" },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    const data = JSON.parse(res._getData());
    expect(Array.isArray(data.apps)).toBe(true);
    expect(data.apps.length).toBe(0);
  });

  it("returns 404 when app is missing", async () => {
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
      query: { app_id: "com.not.exists" },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(404);
    expect(JSON.parse(res._getData())).toEqual({
      error: {
        code: "NOT_FOUND",
        message: "MiniApp not found",
      },
    });
  });
});
