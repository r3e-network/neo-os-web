import {
  assertWalletNetworkMatchesTarget,
  getWalletNetworkGuardReason,
  normalizeNeoNetwork,
} from "@/lib/neo-network";

describe("neo network safety helpers", () => {
  it("normalizes Neo N3 mainnet and testnet identifiers", () => {
    expect(normalizeNeoNetwork("neo-n3-mainnet")).toBe("mainnet");
    expect(normalizeNeoNetwork("testnet")).toBe("testnet");
    expect(normalizeNeoNetwork(860833102)).toBe("mainnet");
    expect(normalizeNeoNetwork(894710606)).toBe("testnet");
    expect(normalizeNeoNetwork("unknown")).toBeNull();
  });

  it("fails closed when the wallet network is missing or mismatched", () => {
    expect(getWalletNetworkGuardReason(null, "mainnet")).toMatch(
      /not verified/i,
    );
    expect(getWalletNetworkGuardReason("testnet", "mainnet")).toMatch(
      /targets Neo N3 Mainnet/i,
    );
    expect(getWalletNetworkGuardReason("mainnet", "mainnet")).toBeNull();
    expect(() =>
      assertWalletNetworkMatchesTarget("testnet", "mainnet"),
    ).toThrow(/Switch wallet network/i);
  });
});
