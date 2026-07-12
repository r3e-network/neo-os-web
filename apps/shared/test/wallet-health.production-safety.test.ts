import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { manifest } from "../../wallet-health/src/manifest";

function appFile(relativePath: string): string {
  const sharedRoot = process.cwd().endsWith("/apps/shared")
    ? process.cwd()
    : resolve(process.cwd(), "apps/shared");
  return readFileSync(resolve(sharedRoot, `../wallet-health/${relativePath}`), "utf8");
}

describe("wallet-health production safety", () => {
  it("declares a read-only optional-wallet tool", () => {
    expect(manifest.features?.walletRequired).toBe(false);
    expect(manifest.features?.chainWarning).toBe(false);
    expect(manifest.permissions).toEqual({
      payments: false,
      randomness: false,
      compute: false,
      oracle: false,
    });

    const neo = JSON.parse(appFile("neo-manifest.json")) as {
      version: string;
      contracts: Record<string, string>;
      permissions: string[];
      features: { stateless: boolean };
      platform: { analytics: boolean; transactions: boolean };
      stateSource?: unknown;
    };
    const pkg = JSON.parse(appFile("package.json")) as { version: string };
    expect(neo.version).toBe("1.1.0");
    expect(pkg.version).toBe(neo.version);
    expect(neo.contracts).toEqual({});
    expect(neo.permissions).toEqual(["read:blockchain"]);
    expect(neo.features.stateless).toBe(false);
    expect(neo.platform.transactions).toBe(false);
    expect(neo.platform.analytics).toBe(false);
    expect(neo.stateSource).toBeUndefined();
  });

  it("has no chain-write or fake automated-audit path", () => {
    const entry = appFile("src/main.tsx");
    const analysis = appFile("src/composables/useWalletAnalysis.ts");
    const score = appFile("src/composables/useHealthScore.ts");
    const messages = appFile("src/locale/messages.ts");

    expect(entry).not.toContain("chain.invoke");
    expect(entry).not.toContain("invoke:primary");
    // Address-sync wiring pin (assertion updated with the framework P0-5
    // migration, same safety property): the entry point must reset
    // address-derived state and refresh balances when the wallet identity
    // changes. Previously hand-rolled as `health.handleAddressChange(next ||
    // null)` behind a lastAddress diff; now expressed through the framework's
    // identity-diff hook, which delivers `current: string | null` directly.
    expect(entry).toContain("wallet.onAccountChanged");
    expect(entry).toContain("health.handleAddressChange(current)");
    expect(entry).toContain("health.refreshBalances().catch");
    expect(analysis).toContain('app.wallet.raw("NEO", address)');
    expect(analysis).toContain('app.wallet.raw("GAS", address)');
    expect(analysis).toContain("Promise.allSettled");
    expect(analysis).toContain("addressToScriptHash(address)");
    expect(analysis).toContain('dataStatus.set(successfulBalanceReads === 1 ? "partial" : "error")');
    expect(analysis).toContain('neoReadStatus.set("failed")');
    expect(analysis).toContain('gasReadStatus.set("failed")');
    expect(analysis).toContain('return value === 0n ? "zero" : "pass"');
    expect(analysis).toContain("app.chain.detectNetwork()");
    expect(analysis).toContain("WALLET_CONNECT_TIMEOUT_MS");
    expect(analysis).toContain("WALLET_READ_TIMEOUT_MS");
    expect(analysis).toContain("readWithTimeout");
    expect(analysis).toContain("requestRevision !== identityRevision");
    expect(score).toContain("manualChecklistIds");
    expect(messages).toContain("not a wallet audit or guarantee of safety");
  });

  it("uses official token art and documents the evidence boundary", () => {
    const playArea = appFile("src/PlayArea.tsx");
    const status = appFile("PRODUCTION_STATUS.md");

    expect(playArea).toContain('from "@shared/art/token-assets"');
    expect(playArea).toContain("officialNeoTokenUrl");
    expect(playArea).toContain("officialGasTokenUrl");
    expect(status).toContain("unknown / reading / failed / zero / pass");
    expect(status).toContain("No contract is configured or required");
  });
});
