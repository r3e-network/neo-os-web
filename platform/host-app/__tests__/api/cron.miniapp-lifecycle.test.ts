import { createMocks } from "node-mocks-http";
import type { NextApiRequest, NextApiResponse } from "next";

function b64(value: string) {
  return Buffer.from(value, "utf8").toString("base64");
}

describe("/api/cron/miniapp-lifecycle", () => {
  const invokeRead = jest.fn();

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    process.env.CRON_SECRET = "cron-secret";

    jest.doMock("@/lib/miniapp-definitions", () => ({
      loadMiniAppDefinitions: jest.fn(async () => [
        {
          app_id: "miniapp-countdown-a",
          name: "Countdown A",
          description: "Countdown game",
          icon: "timer",
          category: "gaming",
          entry_url: "mf://manifest?app=miniapp-countdown-a",
          permissions: {},
          manifest: {
            runtime: {
              mode: "platform",
              modules: [
                {
                  binding: "countdown-auction",
                  platform: "PlatformGame",
                  appId: "miniapp-countdown-a",
                  moduleType: 1,
                  networks: {
                    "neo-n3-testnet": {
                      contract_hash: "0x740671b10330ef6669ab8b2724437eb8d5e7a34c",
                      registered: true,
                    },
                  },
                  operations: {
                    status: "getCountdownStatus",
                    rollover: "checkAndEndCountdownRound",
                  },
                },
              ],
            },
          },
        },
      ]),
    }));

    jest.doMock("@/lib/chain/rpc-client", () => ({
      invokeRead,
    }));
  });

  afterEach(() => {
    delete process.env.CRON_SECRET;
    delete process.env.MINIAPP_LIFECYCLE_RELAYER_URL;
  });

  it("dry-runs automatic countdown lifecycle maintenance for every matching app", async () => {
    invokeRead.mockResolvedValue({
      state: "HALT",
      stack: [
        {
          type: "Map",
          value: [
            { key: { type: "ByteString", value: b64("roundId") }, value: { type: "Integer", value: "7" } },
            { key: { type: "ByteString", value: b64("active") }, value: { type: "Boolean", value: true } },
            { key: { type: "ByteString", value: b64("status") }, value: { type: "ByteString", value: b64("ending") } },
            { key: { type: "ByteString", value: b64("remainingTime") }, value: { type: "Integer", value: "0" } },
          ],
        },
      ],
    });

    const handler = require("@/pages/api/cron/miniapp-lifecycle").default as (
      req: NextApiRequest,
      res: NextApiResponse,
    ) => Promise<void>;

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
      query: { network: "testnet", dry_run: "true" },
      headers: { authorization: "Bearer cron-secret" },
    });

    await handler(req, res);

    expect(invokeRead).toHaveBeenCalledWith(
      "0x740671b10330ef6669ab8b2724437eb8d5e7a34c",
      "getCountdownStatus",
      [{ type: "String", value: "miniapp-countdown-a" }],
      "testnet",
    );
    expect(res._getStatusCode()).toBe(200);
    expect(JSON.parse(res._getData())).toMatchObject({
      success: true,
      network: "testnet",
      dryRun: true,
      results: [
        {
          appId: "miniapp-countdown-a",
          decision: { action: "rollover_needed" },
          invoke: {
            scriptHash: "0x740671b10330ef6669ab8b2724437eb8d5e7a34c",
            operation: "checkAndEndCountdownRound",
          },
          submitted: false,
        },
      ],
    });
  });

  it("requires the cron secret", async () => {
    const handler = require("@/pages/api/cron/miniapp-lifecycle").default as (
      req: NextApiRequest,
      res: NextApiResponse,
    ) => Promise<void>;

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
      headers: { authorization: "Bearer wrong" },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(401);
  });
});
