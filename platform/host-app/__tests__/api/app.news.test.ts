import { createMocks } from "node-mocks-http";
import type { NextApiRequest, NextApiResponse } from "next";

describe("/api/app/[id]/news", () => {
  const originalEdgeBaseUrl = process.env.EDGE_BASE_URL;
  const originalFetch = global.fetch;

  afterEach(() => {
    jest.resetModules();
    if (originalEdgeBaseUrl == null)
      Reflect.deleteProperty(process.env, "EDGE_BASE_URL");
    else process.env.EDGE_BASE_URL = originalEdgeBaseUrl;
    if (originalFetch) global.fetch = originalFetch;
    else Reflect.deleteProperty(global, "fetch");
  });

  it("degrades optional news to an empty feed when the edge upstream fails", async () => {
    process.env.EDGE_BASE_URL = "https://edge.example/functions/v1";
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: "upstream down" }),
    } as Response) as unknown as typeof global.fetch;

    const handler = require("@/pages/api/app/[id]/news").default as (
      req: NextApiRequest,
      res: NextApiResponse,
    ) => Promise<void>;

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
      query: { id: "miniapp-last-survivor", limit: "20" },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    expect(JSON.parse(res._getData())).toEqual({ items: [], total: 0 });
  });
});
