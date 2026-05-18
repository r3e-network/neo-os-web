import { createMocks } from "node-mocks-http";
import type { NextApiRequest, NextApiResponse } from "next";

describe("/api/activity/transactions", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    delete process.env.EDGE_BASE_URL;
    delete process.env.NEXT_PUBLIC_EDGE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  });

  it("rejects missing network instead of silently selecting mainnet", async () => {
    const handler = require("@/pages/api/activity/transactions").default as (
      req: NextApiRequest,
      res: NextApiResponse,
    ) => Promise<void>;

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
      query: { app_id: "miniapp-profitanchor", limit: "1" },
      headers: { "x-forwarded-for": "203.0.113.44" },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(400);
    expect(JSON.parse(res._getData())).toEqual({
      error: { code: "BAD_REQUEST", message: "network must be mainnet or testnet" },
    });
  });
});
