import {
  normalizeOneGateVaultDiagnosticInput,
  summarizeOneGateVaultDiagnostics,
} from "@/lib/onegate-vault-diagnostics";

describe("OneGate Vault diagnostics", () => {
  it("redacts QR keys, wallet addresses, and sensitive URL params before storage", () => {
    const record = normalizeOneGateVaultDiagnosticInput({
      eventType: "missing_address",
      network: "mainnet",
      source: "onegate",
      operation: "claimOneGateVault",
      poolId: "pool-001",
      oneGateAppId: "23",
      appId: "miniapp-gas-lucky-pool",
      locale: "ja-JP",
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X)",
      message:
        "OneGate did not provide a wallet address. key=ogv_live_key_1234567890 address=NWMjW2tnPKSuSdHme5uYk86vFm8hyoHeJ3 token=abc123",
      diagnostic:
        "ogvdiag provider=none bridge=invoke callback=function url=https://onegate.space/app/23?key=ogv_live_key_1234567890&network=mainnet",
      details: {
        href: "https://onegate.space/app/23?key=ogv_live_key_1234567890",
        account: "NWMjW2tnPKSuSdHme5uYk86vFm8hyoHeJ3",
      },
    });

    const serialized = JSON.stringify(record);
    expect(record.network).toBe("mainnet");
    expect(record.eventType).toBe("missing_address");
    expect(record.fingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(serialized).not.toContain("ogv_live_key_1234567890");
    expect(serialized).not.toContain("NWMjW2tnPKSuSdHme5uYk86vFm8hyoHeJ3");
    expect(serialized).not.toContain("token=abc123");
    expect(serialized).not.toContain("onegate.space/app/23?key=");
  });

  it("groups recent failures by platform and fingerprint for analysis", () => {
    const records = [
      normalizeOneGateVaultDiagnosticInput({
        eventType: "missing_address",
        network: "mainnet",
        userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X)",
        diagnostic: "ogvdiag provider=none bridge=invoke callback=function",
      }),
      normalizeOneGateVaultDiagnosticInput({
        eventType: "missing_address",
        network: "mainnet",
        userAgent: "Mozilla/5.0 (Linux; Android 15)",
        diagnostic: "ogvdiag provider=direct bridge=none callback=none",
      }),
    ];

    const summary = summarizeOneGateVaultDiagnostics(records);

    expect(summary.total).toBe(2);
    expect(summary.byPlatform.iphone).toBe(1);
    expect(summary.byPlatform.android).toBe(1);
    expect(summary.groups.length).toBe(2);
  });
});
