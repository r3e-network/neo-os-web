import { createMocks } from "node-mocks-http";
import type { NextApiRequest, NextApiResponse } from "next";

describe("/api/miniapps/[appId]/live", () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it("rejects unknown apps instead of accepting arbitrary contract hashes", async () => {
    const handler = require("@/pages/api/miniapps/[appId]/live").default as (
      req: NextApiRequest,
      res: NextApiResponse,
    ) => Promise<void>;

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
      query: { appId: "miniapp-not-real" },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(400);
  });

  it("returns live status for a whitelisted flagship app", async () => {
    const getLiveStatus = jest.fn().mockResolvedValue({
      appId: "miniapp-fogplay",
      playersOnline: 3,
    });

    jest.doMock("../../lib/miniapp-stats", () => ({
      getLiveStatus,
    }));

    const handler = require("@/pages/api/miniapps/[appId]/live").default as (
      req: NextApiRequest,
      res: NextApiResponse,
    ) => Promise<void>;

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
      query: { appId: "miniapp-fogplay" },
    });

    await handler(req, res);

    expect(getLiveStatus).toHaveBeenCalled();
    expect(res._getStatusCode()).toBe(200);
    expect(JSON.parse(res._getData())).toEqual({
      status: {
        appId: "miniapp-fogplay",
        playersOnline: 3,
      },
    });
  });

  it("returns live status for a bundled shared-mode app without requiring FLAGSHIP_APPS", async () => {
    const getLiveStatus = jest.fn().mockResolvedValue({
      appId: "miniapp-neo-pay-shared-example",
      tvl: "0",
      volume24h: "7",
    });

    jest.doMock("../../lib/miniapp-stats", () => ({
      getLiveStatus,
    }));
    jest.doMock("../../lib/miniapp-definitions", () => ({
      loadBundledMiniAppById: jest.fn().mockResolvedValue({
        app_id: "miniapp-neo-pay-shared-example",
        category: "defi",
        contract_hash: null,
        manifest: {
          contract_composition: { mode: "shared" },
        },
      }),
    }));
    jest.doMock("../../lib/chain/shared-mode", () => ({
      isSharedModeApp: jest.fn().mockReturnValue(true),
    }));

    const handler = require("@/pages/api/miniapps/[appId]/live").default as (
      req: NextApiRequest,
      res: NextApiResponse,
    ) => Promise<void>;

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
      query: { appId: "miniapp-neo-pay-shared-example" },
    });

    await handler(req, res);

    expect(getLiveStatus).toHaveBeenCalledWith(
      "miniapp-neo-pay-shared-example",
      "",
      "defi",
      "testnet",
    );
    expect(res._getStatusCode()).toBe(200);
  });
});
