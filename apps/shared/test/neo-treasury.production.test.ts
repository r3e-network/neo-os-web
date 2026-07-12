import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const appRoot = resolve(__dirname, "../../neo-treasury");
const read = (path: string) => readFileSync(resolve(appRoot, path), "utf8");

describe("neo-treasury production contract", () => {
  it("declares the real direct-native-token model without a fake treasury deployment", () => {
    const manifest = JSON.parse(read("neo-manifest.json")) as Record<string, unknown>;
    expect(manifest.contracts).toEqual({});
    expect(manifest.name_zh).toBe("Neo 国库");
    expect(manifest.supported_networks).toEqual(["neo-n3-mainnet", "neo-n3-testnet"]);
    expect((manifest.features as Record<string, unknown>).stateless).toBe(false);
    expect(((manifest.stateSource as Record<string, unknown>).endpoints as string[])).toContain("https://api.n3index.dev");
    expect(read("README.md")).toContain("There is no treasury vault, proposal ID, signer roster, quorum, admin role, timelock, or on-chain proposal expiry");
    expect(read("TESTNET_STATUS.md")).toContain("A funded Testnet wallet broadcast was intentionally not performed");
  });

  it("requires exact native Transfer matching, state readback, and persisted non-rebroadcast recovery", () => {
    const main = read("src/main.tsx");
    const operations = read("src/utils/treasuryOperations.ts");
    expect(main).toContain("onTransactionSent: rememberBroadcast");
    expect(main).toContain("inspectPendingTreasuryTransfer(recovery");
    expect(main).toContain('verified: settlement?.status === "confirmed"');
    expect(main).toContain('ctx.framework.actions.register("recoverDisbursement"');
    expect(operations).toContain("normalizeHash(record.contract_hash ?? record.contractHash) === pending.scriptHash");
    expect(operations).toContain("transferHash(record.from_address");
    expect(operations).toContain("transferHash(record.to_address");
    expect(operations).toContain("BigInt(amountRaw) === BigInt(pending.scaledAmount)");
    expect(operations).toContain("currentRecipientBalance < expectedMinimum");
    expect(operations).toContain("currentSenderBalance > expectedSenderMaximum");
    expect(operations).toMatch(/currentRecipientBalance < expectedMinimum\s*\|\|\s*currentSenderBalance > expectedSenderMaximum/);
  });

  it("keeps native-balance cache freshness separate from price-record freshness", () => {
    const main = read("src/main.tsx");
    const treasury = read("src/utils/treasury.ts");
    expect(main).toContain("stale.set(false)");
    expect(treasury).toContain("priceStale = isPriceDelayed(prices, now)");
  });

  it("keeps official tokens, mainnet watchlist disclosure, and governance limits visible but secondary", () => {
    const playArea = read("src/PlayArea.tsx");
    const messages = read("src/locale/messages.ts");
    expect(playArea).toContain('import { CoinArt } from "@shared/art"');
    expect(playArea).toContain('t("networkMainnet")');
    expect(playArea).toContain("treasury-policy-grid");
    expect(playArea).toContain("treasury-drawer__recovery");
    expect(playArea).toContain("treasury-allocation__rows");
    expect(playArea).toContain("treasury-price-status");
    expect(playArea).not.toContain(".slice(0, 5)");
    expect(read("src/utils/treasury.ts")).toContain('WATCHLIST_REFERENCE_URL = "https://neo-treasury.pages.dev/"');
    expect(messages).toContain("No treasury contract, proposal ID, quorum, admin role, or on-chain expiry is configured");
    expect(messages).not.toContain("txid proves success");
    expect(read("ASSET_PROVENANCE.md")).toContain("Official Neo Press Kit NEO and GAS icons");
  });

  it("keeps public native-balance presentation exact instead of aggregating with floats", () => {
    const main = read("src/main.tsx");
    const treasury = read("src/utils/treasury.ts");
    expect(treasury).toContain("let totalNeoRaw = 0n");
    expect(treasury).toContain("let totalGasRaw = 0n");
    expect(treasury).toContain("formatTreasuryTokenAmount(totalGasRaw, 8)");
    expect(main).toContain("d?.totalNeoDisplay");
    expect(main).toContain("d?.totalGasDisplay");
  });

  it("keeps the platform fallback honest about the watched wallets and confirmation proof", () => {
    const hostProfile = readFileSync(
      resolve(appRoot, "../../platform/host-app/components/playarea/PlayAreaProfilesBusiness.tsx"),
      "utf8",
    );
    const treasuryProfile = hostProfile.slice(
      hostProfile.indexOf('"miniapp-neo-treasury"'),
      hostProfile.indexOf('"miniapp-neodid-passport"'),
    );
    expect(treasuryProfile).toContain('title: "Public treasury watchlist"');
    expect(treasuryProfile).toContain('{ label: "Transfer source", value: "connected wallet" }');
    expect(treasuryProfile).toContain('{ label: "Proof", value: "event + balances" }');
    expect(treasuryProfile).not.toContain("txid proof");
  });
});
