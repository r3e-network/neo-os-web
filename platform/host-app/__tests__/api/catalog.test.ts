import { createMocks } from "node-mocks-http";
import type { NextApiRequest, NextApiResponse } from "next";
import path from "path";
import type { MiniAppInfo } from "@/components/types";
import { supportsCatalogNetwork } from "@/lib/miniapp-catalog";
import handler from "@/pages/api/miniapps/catalog";

describe("/api/miniapps/catalog", () => {
  const previousDefinitionsDir = process.env.MINIAPP_DEFINITIONS_DIR;
  const previousCatalogSource = process.env.MINIAPP_CATALOG_SOURCE;
  const previousTargetNetwork = process.env.NEO_TARGET_NETWORK;

  function restoreTargetNetwork() {
    if (previousTargetNetwork === undefined) {
      delete process.env.NEO_TARGET_NETWORK;
    } else {
      process.env.NEO_TARGET_NETWORK = previousTargetNetwork;
    }
  }

  beforeAll(() => {
    process.env.MINIAPP_DEFINITIONS_DIR = path.resolve(process.cwd(), "public", "miniapp-definitions");
    process.env.MINIAPP_CATALOG_SOURCE = "local";
  });

  afterAll(() => {
    process.env.MINIAPP_DEFINITIONS_DIR = previousDefinitionsDir;
    process.env.MINIAPP_CATALOG_SOURCE = previousCatalogSource;
    restoreTargetNetwork();
  });

  afterEach(() => {
    restoreTargetNetwork();
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

  it("resolves legacy flagship aliases to canonical bundled definitions", async () => {
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
      query: { app_id: "miniapp-doomsday-clock" },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    const data = JSON.parse(res._getData());
    expect(data.app).toEqual(
      expect.objectContaining({
        app_id: "miniapp-last-survivor",
        logo_url: expect.stringContaining("last-survivor"),
        banner_url: expect.stringContaining("last-survivor"),
      }),
    );
  });

  it("filters active catalog to apps available on the requested mainnet", async () => {
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
      query: { network: "mainnet" },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    const data = JSON.parse(res._getData());
    const ids = new Set(data.apps.map((app: { app_id: string }) => app.app_id));
    expect(ids.has("miniapp-neo-pay")).toBe(true);
    expect(ids.has("miniapp-profitanchor")).toBe(true);
    expect(ids.has("miniapp-trustanchor")).toBe(true);
    expect(ids.has("miniapp-event-ticket-pass")).toBe(false);
  });

  it("does not return a testnet-only miniapp for a mainnet app detail request", async () => {
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
      query: { app_id: "miniapp-event-ticket-pass", network: "mainnet" },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(404);
  });

  it("uses platform runtime contracts when filtering by network", () => {
    const app: MiniAppInfo = {
      app_id: "miniapp-runtime-game",
      name: "Runtime Game",
      description: "Shared platform runtime only",
      icon: "timer",
      category: "gaming",
      entry_url: "mf://manifest?app=miniapp-runtime-game",
      permissions: {},
      manifest: {
        runtime: {
          mode: "platform",
          modules: [
            {
              binding: "countdown-auction",
              platform: "PlatformGame",
              appId: "runtime-game",
              moduleType: 1,
              networks: {
                "neo-n3-testnet": {
                  contract_hash: "0x740671b10330ef6669ab8b2724437eb8d5e7a34c",
                  registered: true,
                },
              },
            },
          ],
        },
      },
    };

    expect(supportsCatalogNetwork(app, "neo-n3-testnet")).toBe(true);
    expect(supportsCatalogNetwork(app, "neo-n3-mainnet")).toBe(false);
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
