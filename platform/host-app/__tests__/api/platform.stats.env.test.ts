import { createMocks } from "node-mocks-http";
import type { NextApiRequest, NextApiResponse } from "next";
import path from "path";

describe("/api/platform/stats env access", () => {
  const originalDefinitionsDir = process.env.MINIAPP_DEFINITIONS_DIR;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    delete process.env.PLATFORM_TX_COUNT;
    process.env.MINIAPP_DEFINITIONS_DIR = path.resolve(
      __dirname,
      "../../public/miniapp-definitions",
    );
  });

  afterEach(() => {
    if (originalDefinitionsDir === undefined) {
      delete process.env.MINIAPP_DEFINITIONS_DIR;
    } else {
      process.env.MINIAPP_DEFINITIONS_DIR = originalDefinitionsDir;
    }
  });

  it("does not return hard-coded platform transaction counts when live stats are unavailable", async () => {
    jest.doMock("../../lib/supabase", () => ({
      supabase: null,
      isSupabaseConfigured: false,
    }));

    const handler = require("@/pages/api/platform/stats").default as (
      req: NextApiRequest,
      res: NextApiResponse,
    ) => Promise<void>;

    process.env.PLATFORM_TX_COUNT = "777777";

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({ method: "GET" });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    const payload = JSON.parse(res._getData());
    expect(payload.totalTransactions).toBeNull();
    expect(payload.sources.totalTransactions).toBe("unavailable");
    expect(payload.activeApps).toBeGreaterThanOrEqual(50);
    expect(payload.sources.activeApps).toBe("bundled_definitions");
  });
});
