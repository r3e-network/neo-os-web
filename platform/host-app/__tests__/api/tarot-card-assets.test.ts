import { createMocks } from "node-mocks-http";
import type { NextApiRequest, NextApiResponse } from "next";
import handler from "@/pages/api/miniapps/on-chain-tarot/cards/[file]";

/**
 * This route exists for the absolute /miniapps/on-chain-tarot/cards/* URLs that
 * were valid while the platform served the bundle from its own public directory
 * - cached clients still use them.
 *
 * What the platform owns is the routing contract: a valid card name redirects
 * into the published bundle, and anything outside the allowlist is refused. The
 * deck's own shape - 78 cards, the right names, real WebP bytes - is asserted in
 * neo-minigames, which holds the art.
 */
jest.mock("@/lib/miniapp-cdn", () => ({
  isMiniAppCdnEnabled: () => true,
  findMiniAppCdnApp: async (slug: string) =>
    slug === "on-chain-tarot"
      ? { entry_url: "https://meshmini.app/minigames/on-chain-tarot/2.0.0/index.html" }
      : null,
}));

async function request(file: string) {
  const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
    method: "GET",
    query: { file },
  });
  await handler(req, res);
  return res;
}

describe("/api/miniapps/on-chain-tarot/cards/[file]", () => {
  it("redirects the deck index into the published bundle", async () => {
    const res = await request("index.json");

    expect(res._getStatusCode()).toBe(302);
    expect(res._getRedirectUrl()).toBe(
      "https://meshmini.app/minigames/on-chain-tarot/2.0.0/cards/index.json",
    );
  });

  it("redirects card art into the published bundle", async () => {
    const res = await request("00-the-fool.webp");

    expect(res._getStatusCode()).toBe(302);
    expect(res._getRedirectUrl()).toBe(
      "https://meshmini.app/minigames/on-chain-tarot/2.0.0/cards/00-the-fool.webp",
    );
  });

  it("refuses a name outside the card allowlist rather than redirecting it", async () => {
    const res = await request("secrets.env");

    expect(res._getStatusCode()).toBe(404);
    expect(res._getRedirectUrl()).toBe("");
  });

  it("rejects path traversal attempts", async () => {
    const res = await request("../neo-manifest.json");

    expect(res._getStatusCode()).toBe(404);
    expect(res._getRedirectUrl()).toBe("");
  });
});
