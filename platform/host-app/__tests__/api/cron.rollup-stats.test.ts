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
        "miniapp-last-survivor": { contract: "0xf0914d411877c8393c029f48ec0c4c64d44f1b49", category: "gaming" },
        "miniapp-gasbox": { contract: "0x523c112560a2e196fa0fcfa215d93c08e117d9c1", category: "gaming" },
        "miniapp-redenvelope": { contract: "0x4079c09a0ff121fc44d817c37d6ae8694b268e9f", category: "social" },
        "miniapp-dailycheckin": { contract: "0xdd01243419941e8cdc8eb194a9d1fc7fcbafd528", category: "gaming" },
        "miniapp-fogplay": { contract: "0x43f953c00931ca38044bf0e5ca50d608aea7ae8b", category: "gaming" },
        "miniapp-self-loan": { contract: "0x2a19ae9c53a5373d064adaff5c6be1c545f00e2b", category: "defi" },
        "miniapp-neo-pay": { contract: "0x89d2499928e3035247186f412934d6b0e0b665ef", category: "defi" },
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
