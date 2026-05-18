import { createMocks } from "node-mocks-http";
import type { NextApiRequest, NextApiResponse } from "next";

describe("/api/miniapps/batch-stats", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it("rejects missing network instead of silently using testnet", async () => {
    const handler = require("@/pages/api/miniapps/batch-stats").default as (
      req: NextApiRequest,
      res: NextApiResponse,
    ) => Promise<void>;

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
      query: { appIds: "miniapp-fogplay" },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(400);
    expect(JSON.parse(res._getData())).toEqual({
      error: { code: "BAD_REQUEST", message: "network must be mainnet or testnet" },
    });
  });
});
