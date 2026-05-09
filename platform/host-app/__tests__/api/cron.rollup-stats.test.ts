import { createMocks } from "node-mocks-http";
import type { NextApiRequest, NextApiResponse } from "next";

describe("/api/cron/rollup-stats", () => {
  const getContractStats = jest.fn();
  const upsert = jest.fn();

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    process.env.CRON_SECRET = "cron-secret";
  });

  it("rolls up the current flagship app set", async () => {
    getContractStats.mockResolvedValue({
      totalValueLocked: "0",
      totalTransactions: 0,
      uniqueUsers: 0,
    });
    upsert.mockResolvedValue({ error: null });

    jest.doMock("../../lib/chain", () => ({
      getFlagshipApps: () => ({
        "miniapp-last-survivor": { contract: "0x1021e9e5c17285e706c293a39c525de13100ed92", category: "gaming" },
        "miniapp-gasbox": { contract: "0x49ec8536ba331d744a16b8da2a6ed4263ef4e89c", category: "gaming" },
        "miniapp-redenvelope": { contract: "0xfa1b7240fead2a63999c02defa3aec5eb274a919", category: "social" },
        "miniapp-dailycheckin": { contract: "0xaba84da240a55410d284a656fc8dae044e6ec1a5", category: "gaming" },
        "miniapp-fogplay": { contract: "0xb115dd775a7591bb0eedef6dbf50428d50e7bc07", category: "gaming" },
        "miniapp-self-loan": { contract: "0xb4aa0bdbfec40b44fa1ec4461c8c347829a79ada", category: "defi" },
        "miniapp-neo-pay": { contract: "0x27a81e6d2f01a1d241b9aef5bed74c93f3a5ca5e", category: "defi" },
        "miniapp-trustanchor": { contract: "0xee1819916a6b8c7a8c30506af3318c758850033a", category: "defi" },
        "miniapp-profitanchor": { contract: "0xee1819916a6b8c7a8c30506af3318c758850033a", category: "defi" },
      }),
      getContractStats,
    }));

    jest.doMock("@/lib/server-supabase", () => ({
      getServerSupabaseClient: jest.fn(() => ({
        from: () => ({
          upsert,
        }),
      })),
    }));

    const handler = require("@/pages/api/cron/rollup-stats").default as (
      req: NextApiRequest,
      res: NextApiResponse,
    ) => Promise<void>;

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
      headers: { authorization: "Bearer cron-secret" },
    });

    await handler(req, res);

    expect(getContractStats).toHaveBeenCalledTimes(9);
    expect(upsert).toHaveBeenCalledTimes(9);
    expect(res._getStatusCode()).toBe(200);
    expect(JSON.parse(res._getData()).results).toHaveLength(9);
  });
});
