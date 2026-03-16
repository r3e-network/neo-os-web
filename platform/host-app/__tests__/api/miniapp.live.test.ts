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
      appId: "miniapp-coinflip",
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
      query: { appId: "miniapp-coinflip" },
    });

    await handler(req, res);

    expect(getLiveStatus).toHaveBeenCalled();
    expect(res._getStatusCode()).toBe(200);
    expect(JSON.parse(res._getData())).toEqual({
      status: {
        appId: "miniapp-coinflip",
        playersOnline: 3,
      },
    });
  });
});
