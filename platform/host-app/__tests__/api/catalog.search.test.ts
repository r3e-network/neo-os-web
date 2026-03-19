import { createMocks } from "node-mocks-http";
import type { NextApiRequest, NextApiResponse } from "next";
import path from "path";
import handler from "@/pages/api/miniapps/catalog";

describe("/api/miniapps/catalog search", () => {
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

  it("filters catalog by search keyword", async () => {
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
      query: { search: "loan" },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    const payload = JSON.parse(res._getData()) as {
      apps: Array<{ app_id: string; name: string }>;
    };

    expect(Array.isArray(payload.apps)).toBe(true);
    expect(payload.apps.length).toBeGreaterThan(0);
    expect(
      payload.apps.every((app) =>
        String(app.app_id).toLowerCase().includes("loan") ||
        String(app.name).toLowerCase().includes("loan"),
      ),
    ).toBe(true);
  });
});
