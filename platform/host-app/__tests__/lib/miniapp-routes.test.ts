import { buildMiniAppDetailHref } from "@/lib/miniapp-routes";

describe("miniapp route helpers", () => {
  it("keeps OneGate Vault host navigation on the host detail route", () => {
    expect(
      buildMiniAppDetailHref("miniapp-gas-lucky-pool", {
        network: "mainnet",
      }),
    ).toBe("/miniapp-detail/miniapp-gas-lucky-pool?network=mainnet");
    expect(buildMiniAppDetailHref("onegate-vault")).toBe(
      "/miniapp-detail/onegate-vault",
    );
  });

  it("leaves ordinary miniapp detail links on the legacy host route", () => {
    expect(
      buildMiniAppDetailHref("miniapp-fogplay", {
        network: "testnet",
      }),
    ).toBe("/miniapps/miniapp-fogplay?network=testnet");
  });
});
