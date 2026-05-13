const nextConfig = require("../../next.config.js");

describe("next config OneGate Vault routing", () => {
  it("serves OneGate Vault aliases as the standalone dApp before the platform page", async () => {
    const rewrites = await nextConfig.rewrites();

    expect(rewrites.beforeFiles).toEqual(
      expect.arrayContaining([
        {
          source: "/miniapps/miniapp-gas-lucky-pool",
          destination: "/miniapps/gas-lucky-pool/index.html",
        },
        {
          source: "/miniapps/miniapp-gas-lucky-pool/",
          destination: "/miniapps/gas-lucky-pool/index.html",
        },
        {
          source: "/miniapps/onegate-vault",
          destination: "/miniapps/gas-lucky-pool/index.html",
        },
        {
          source: "/miniapps/onegate-vault/",
          destination: "/miniapps/gas-lucky-pool/index.html",
        },
      ]),
    );
  });
});
