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

  it("rejects missing network instead of silently using testnet", async () => {
    const handler = require("@/pages/api/cron/miniapp-lifecycle").default as (
      req: NextApiRequest,
      res: NextApiResponse,
    ) => Promise<void>;

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
      query: { dry_run: "true" },
      headers: { authorization: "Bearer cron-secret" },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(400);
    expect(JSON.parse(res._getData())).toEqual({
      error: { code: "BAD_REQUEST", message: "network must be mainnet or testnet" },
    });
    expect(invokeRead).not.toHaveBeenCalled();
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

  it("does not emit a start_needed write when the status read faults to empty", async () => {
    // A faulted (or wrong-ABI) status read decodes to {} — which would look like
    // roundId<=0 → start_needed. The lifecycle guard must reject that empty read
    // so the cron degrades the target to a no-op instead of (re)starting a round.
    invokeRead.mockResolvedValue({ state: "FAULT", stack: [] });

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

    expect(res._getStatusCode()).toBe(200);
    const body = JSON.parse(res._getData());
    expect(body.success).toBe(true);
    // No relayer invoke is produced for the unreadable target.
    expect(body.results[0].invoke).toBeNull();
    expect(body.results[0].decision.action).not.toBe("start_needed");
    expect(body.actionCount).toBe(0);
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
