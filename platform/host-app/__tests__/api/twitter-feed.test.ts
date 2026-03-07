import { createMocks } from "node-mocks-http";
import type { NextApiRequest, NextApiResponse } from "next";

describe("/api/twitter-feed", () => {
  const mockFetch = jest.fn();

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    mockFetch.mockReset();
    global.fetch = mockFetch;
    delete process.env.EDGE_API_BASE;
    delete process.env.EDGE_BASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  });

  it("reads edge env lazily through the shared resolver", async () => {
    const handler = require("@/pages/api/twitter-feed").default as (
      req: NextApiRequest,
      res: NextApiResponse,
    ) => Promise<void>;

    process.env.EDGE_BASE_URL = "https://edge.example/functions/v1";

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ tweets: [{ id: "t1", text: "hello" }] }),
    });

    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
    });

    await handler(req, res);

    expect(mockFetch).toHaveBeenCalledWith(
      "https://edge.example/functions/v1/twitter-feed",
      expect.objectContaining({ signal: expect.any(Object) }),
    );
    expect(res._getStatusCode()).toBe(200);
    expect(JSON.parse(res._getData())).toEqual({ tweets: [{ id: "t1", text: "hello" }] });
  });
});
