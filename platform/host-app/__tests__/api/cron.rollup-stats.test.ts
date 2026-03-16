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
      FLAGSHIP_APPS: {
        "miniapp-doomsday-clock": { contract: "0xf0914d411877c8393c029f48ec0c4c64d44f1b49", category: "gaming" },
        "miniapp-neo-gacha": { contract: "0x13f7a9e8202c9ea6f3a9040a1773e28f03077d7d", category: "gaming" },
        "miniapp-redenvelope": { contract: "0xa28379b2e0a608053458d435acd7041fc4a0fded", category: "social" },
        "miniapp-dailycheckin": { contract: "0x297bfabe68535ab1abfadb843d5a5c00db7aca75", category: "gaming" },
        "miniapp-coinflip": { contract: "0x01d0e1f78ea5a76b6bb0bce26649d5bf449999e0", category: "gaming" },
        "miniapp-self-loan": { contract: "0x2a19ae9c53a5373d064adaff5c6be1c545f00e2b", category: "defi" },
        "miniapp-stream-vault": { contract: "0x89d2499928e3035247186f412934d6b0e0b665ef", category: "defi" },
      },
      getContractStats,
    }));

    jest.doMock("../../lib/supabase", () => ({
      isSupabaseConfigured: true,
      supabase: {
        from: () => ({
          upsert,
        }),
      },
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

    expect(getContractStats).toHaveBeenCalledTimes(7);
    expect(upsert).toHaveBeenCalledTimes(7);
    expect(res._getStatusCode()).toBe(200);
    expect(JSON.parse(res._getData()).results).toHaveLength(7);
  });
});
