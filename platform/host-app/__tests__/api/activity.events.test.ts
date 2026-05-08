import { createMocks } from "node-mocks-http";
import type { NextApiRequest, NextApiResponse } from "next";

describe("/api/activity/events", () => {
  const mockFetch = jest.fn();
  const previousEdgeBaseUrl = process.env.EDGE_BASE_URL;
  const previousPublicEdgeUrl = process.env.NEXT_PUBLIC_EDGE_URL;
  const previousSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const previousMainnetRpc = process.env.NEO_RPC_MAINNET;
  const previousTestnetRpc = process.env.NEO_RPC_TESTNET;

  function restoreEnv(key: string, value: string | undefined) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    mockFetch.mockReset();
    global.fetch = mockFetch;
    delete process.env.EDGE_BASE_URL;
    delete process.env.NEXT_PUBLIC_EDGE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    process.env.NEO_RPC_MAINNET = "https://rpc.mainnet.example";
    process.env.NEO_RPC_TESTNET = "https://rpc.testnet.example";
  });

  afterAll(() => {
    restoreEnv("EDGE_BASE_URL", previousEdgeBaseUrl);
    restoreEnv("NEXT_PUBLIC_EDGE_URL", previousPublicEdgeUrl);
    restoreEnv("NEXT_PUBLIC_SUPABASE_URL", previousSupabaseUrl);
    restoreEnv("NEO_RPC_MAINNET", previousMainnetRpc);
    restoreEnv("NEO_RPC_TESTNET", previousTestnetRpc);
  });

  it("uses mainnet for tx_hash application log lookups when requested", async () => {
    const handler = require("@/pages/api/activity/events").default as (
      req: NextApiRequest,
      res: NextApiResponse,
    ) => Promise<void>;

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        result: {
          executions: [
            {
              notifications: [
                {
                  contract: "0x02beeef6f65c6989a121c0a0e6b23190333edb98",
                  eventname: "Claimed",
                  state: [],
                },
              ],
            },
          ],
        },
      }),
    });

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
      url: "/api/activity/events?app_id=miniapp-profitanchor&network=mainnet&tx_hash=0xabc",
      query: {
        app_id: "miniapp-profitanchor",
        network: "mainnet",
        tx_hash: "0xabc",
      },
      headers: { "x-forwarded-for": "203.0.113.41" },
    });

    await handler(req, res);

    expect(mockFetch).toHaveBeenCalledWith(
      "https://rpc.mainnet.example",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"getapplicationlog"'),
      }),
    );
    expect(mockFetch).not.toHaveBeenCalledWith(
      "https://rpc.testnet.example",
      expect.anything(),
    );
    expect(res._getStatusCode()).toBe(200);
    expect(JSON.parse(res._getData())).toEqual(
      expect.objectContaining({
        events: [
          expect.objectContaining({
            event_name: "Claimed",
            tx_hash: "0xabc",
          }),
        ],
        total: 1,
      }),
    );
  });

  it("uses mainnet N3Index events when no edge function is configured", async () => {
    const handler = require("@/pages/api/activity/events").default as (
      req: NextApiRequest,
      res: NextApiResponse,
    ) => Promise<void>;

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    });

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
      url: "/api/activity/events?app_id=miniapp-profitanchor&network=mainnet&limit=1",
      query: {
        app_id: "miniapp-profitanchor",
        network: "mainnet",
        limit: "1",
      },
      headers: { "x-forwarded-for": "203.0.113.42" },
    });

    await handler(req, res);

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining(
        "https://api.n3index.dev/indexer/v1/networks/mainnet/contracts/0x02beeef6f65c6989a121c0a0e6b23190333edb98/events",
      ),
      expect.anything(),
    );
    expect(res._getStatusCode()).toBe(200);
  });
});
