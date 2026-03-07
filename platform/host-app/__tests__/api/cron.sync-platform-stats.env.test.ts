import { createMocks } from "node-mocks-http";
import type { NextApiRequest, NextApiResponse } from "next";

describe("/api/cron/sync-platform-stats env access", () => {
  const upsertMock = jest.fn();
  const fromMock = jest.fn();

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    upsertMock.mockReset();
    fromMock.mockReset();
    delete process.env.NEO_TESTNET_ADDRESS;
    delete process.env.CRON_SECRET;
  });

  it("reads PLATFORM_ADDRESS lazily when persisting sync state", async () => {
    jest.doMock("../../lib/supabase", () => {
      const buildSelectResult = (table: string) => {
        if (table === "simulation_txs") return Promise.resolve({ count: 2, data: [{ account_address: "A1" }] });
        if (table === "service_requests") return Promise.resolve({ count: 3, data: [{ requester: "A2" }] });
        if (table === "contract_events") return Promise.resolve({ count: 4, data: [] });
        return Promise.resolve({ count: 0, data: [] });
      };

      return {
        isSupabaseConfigured: true,
        supabase: {
          from: (table: string) => {
            fromMock(table);
            return {
              select: (_columns: string, options?: { count?: string; head?: boolean }) => {
                if (options?.head) {
                  return Promise.resolve({ count: table === "simulation_txs" ? 2 : table === "service_requests" ? 3 : table === "contract_events" ? 4 : 0 });
                }
                return {
                  not: () => ({
                    limit: () => buildSelectResult(table),
                  }),
                };
              },
              upsert: (payload: unknown) => {
                upsertMock(payload);
                return Promise.resolve({ error: null });
              },
            };
          },
        },
      };
    });

    const handler = require("@/pages/api/cron/sync-platform-stats").default as (
      req: NextApiRequest,
      res: NextApiResponse,
    ) => Promise<void>;

    process.env.CRON_SECRET = "cron-secret";
    process.env.NEO_TESTNET_ADDRESS = "NUpdatedPlatformAddress";

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
      headers: {
        authorization: "Bearer cron-secret",
      },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ address: "NUpdatedPlatformAddress" }),
    );
  });
});
