const nextConfig = require("../../next.config.js");

describe("next config OneGate Vault routing", () => {
  it("keeps platform OneGate Vault detail routes on the host page", async () => {
    const rewrites = await nextConfig.rewrites();

    expect(rewrites.beforeFiles).toEqual([]);
    expect(rewrites.afterFiles).toEqual(
      expect.arrayContaining([
        {
          source: "/miniapps/on-chain-tarot/cards/:file",
          destination: "/api/miniapps/on-chain-tarot/cards/:file",
        },
      ]),
    );
  });

  it("does not allow wildcard frame ancestors for static miniapp assets", async () => {
    const headers = await nextConfig.headers();
    const miniappRule = headers.find((rule: { source: string }) => rule.source === "/miniapps/:path*");
    const csp = miniappRule?.headers.find(
      (header: { key: string }) => header.key === "Content-Security-Policy",
    )?.value;

    expect(csp).toContain(
      "frame-ancestors 'self' https://neomini.app https://onegate.space https://app.miniapp.r3e.network",
    );
    expect(csp).not.toContain("https://*.onegate.space");
    expect(csp).not.toContain("https://*.miniapp.r3e.network");
  });
});
