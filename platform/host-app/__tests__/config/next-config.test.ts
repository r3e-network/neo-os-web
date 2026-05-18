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
});
