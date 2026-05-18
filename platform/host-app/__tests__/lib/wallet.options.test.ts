import { walletOptions, walletOptionsById } from "@/lib/wallet/store";

describe("walletOptions", () => {
  it("uses real wallet logo sources instead of generated placeholder labels", () => {
    expect(walletOptions.map((option) => option.id)).toEqual([
      "onegate",
      "neoline",
    ]);

    expect(walletOptionsById.onegate?.icon).toBe(
      "/miniapps/gas-lucky-pool/onegate-logo.png",
    );
    expect(walletOptionsById.neoline?.icon).toBe(
      "https://neoline.io/assets/images/home/neoline.svg",
    );

    for (const option of walletOptions) {
      expect(option.icon).not.toContain(">NL<");
      expect(option.icon).not.toContain(">OG<");
      expect(option.icon).not.toContain("walletIcon");
      expect(option.description.length).toBeGreaterThan(20);
    }
  });

  it("keeps visible wallet choices on NEP-21 only", () => {
    expect(walletOptionsById.nep21).toMatchObject({
      protocol: "NEP-21",
    });
    expect(walletOptionsById.onegate).toMatchObject({
      protocol: "NEP-21",
      recommended: true,
    });
    expect(walletOptionsById.neoline?.protocol).toBe("NEP-21");
    expect(walletOptions.every((option) => option.protocol === "NEP-21")).toBe(true);
  });
});
