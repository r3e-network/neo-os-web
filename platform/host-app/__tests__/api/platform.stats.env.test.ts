import { createMocks } from "node-mocks-http";
import type { NextApiRequest, NextApiResponse } from "next";

describe("/api/platform/stats env access", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    delete process.env.PLATFORM_TX_COUNT;
  });

  it("reads PLATFORM_TX_COUNT lazily when returning the fallback payload", async () => {
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
    expect(JSON.parse(res._getData())).toEqual(
      expect.objectContaining({ totalTransactions: 777777 }),
    );
  });
});
