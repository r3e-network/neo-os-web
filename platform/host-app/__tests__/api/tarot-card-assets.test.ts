import { createMocks } from "node-mocks-http";
import type { NextApiRequest, NextApiResponse } from "next";
import handler from "@/pages/api/miniapps/on-chain-tarot/cards/[file]";

describe("/api/miniapps/on-chain-tarot/cards/[file]", () => {
  it("serves the tracked tarot deck index used by the host-native playarea", async () => {
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
      query: { file: "index.json" },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    expect(String(res.getHeader("Content-Type"))).toContain("application/json");
    const deck = JSON.parse(res._getData());
    expect(deck).toHaveLength(78);
    expect(deck[0]).toEqual(expect.objectContaining({ id: 0, name: "The Fool" }));
  });

  it("serves tracked SVG card art without relying on generated public miniapp bundles", async () => {
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
      query: { file: "00-the-fool.svg" },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    expect(String(res.getHeader("Content-Type"))).toContain("image/svg+xml");
    expect(Buffer.isBuffer(res._getData())).toBe(true);
  });

  it("rejects path traversal attempts", async () => {
    const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
      method: "GET",
      query: { file: "../neo-manifest.json" },
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(404);
  });
});
