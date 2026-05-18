import { createMocks } from "node-mocks-http";
import type { NextApiRequest, NextApiResponse } from "next";

describe("/api/miniapp-stats", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it("rejects missing network instead of aggregating mixed-chain stats", async () => {
    const handler = require("@/pages/api/miniapp-stats").default as (
      req: NextApiRequest,
      res: NextApiResponse,
    ) => Promise<void>;

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(400);
    expect(JSON.parse(res._getData())).toEqual({
      error: { code: "BAD_REQUEST", message: "network must be mainnet or testnet" },
    });
  });

  it("passes the explicit network into the aggregate RPC", async () => {
    const rpc = jest.fn().mockResolvedValue({
      data: [
        {
          app_id: "miniapp-fogplay",
          total_users: 3,
          total_transactions: 5,
          total_gas_used: 1.25,
        },
      ],
      error: null,
    });

    jest.doMock("@/lib/server-supabase", () => ({
      getServerSupabaseClient: jest.fn(() => ({ rpc })),
    }));

    const handler = require("@/pages/api/miniapp-stats").default as (
      req: NextApiRequest,
      res: NextApiResponse,
    ) => Promise<void>;

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
      query: { network: "testnet", app_id: "miniapp-fogplay" },
    });

    await handler(req, res);

    expect(rpc).toHaveBeenCalledWith("miniapp_stats_aggregate", {
      p_app_id: "miniapp-fogplay",
      p_network: "testnet",
    });
    expect(res._getStatusCode()).toBe(200);
  });
});
