import { walletOptions, walletOptionsById } from "@/lib/wallet/store";

describe("walletOptions", () => {
  it("uses real wallet logo sources instead of generated placeholder labels", () => {
    expect(walletOptions.map((option) => option.id)).toEqual([
      "nep21",
      "onegate",
      "neoline",
      "o3",
    ]);

    expect(walletOptionsById.onegate?.icon).toBe(
      "/miniapps/gas-lucky-pool/onegate-logo.png",
    );
    expect(walletOptionsById.neoline?.icon).toBe(
      "https://neoline.io/assets/images/home/neoline.svg",
    );
    expect(walletOptionsById.o3?.icon).toBe(
      "https://docs.o3.app/~gitbook/icon?size=large&theme=light",
    );

    for (const option of walletOptions) {
      expect(option.icon).not.toContain(">NL<");
      expect(option.icon).not.toContain(">O3<");
      expect(option.icon).not.toContain(">OG<");
      expect(option.icon).not.toContain("walletIcon");
      expect(option.description.length).toBeGreaterThan(20);
    }
  });

  it("prefers NEP-21 while keeping legacy wallet adapters explicit", () => {
    expect(walletOptionsById.nep21).toMatchObject({
      name: "NEP-21 Wallet",
      protocol: "NEP-21",
      recommended: true,
    });
    expect(walletOptionsById.onegate?.protocol).toBe("NEP-21");
    expect(walletOptionsById.neoline?.protocol).toBe("Legacy dAPI");
    expect(walletOptionsById.o3?.protocol).toBe("Legacy dAPI");
  });
});
