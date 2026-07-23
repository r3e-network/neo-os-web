import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(process.cwd(), "..", "..");
const appRoot = path.join(repoRoot, "apps", "self-loan");

describe("self-loan production contract and product truth", () => {
  it("targets the standalone deployed contract without stale PlatformDeFi routing", () => {
    const manifest = JSON.parse(readFileSync(path.join(appRoot, "neo-manifest.json"), "utf8")) as Record<string, unknown>;
    expect(manifest.contracts).toEqual({
      "neo-n3-mainnet": "0x87f94598c78cb954ca8200d3964ded9b584d7250",
      "neo-n3-testnet": "0x87f94598c78cb954ca8200d3964ded9b584d7250",
    });
    expect(manifest).not.toHaveProperty("runtime");
    expect(manifest.technologies).toMatchObject({ keeper: { enabled: false } });
  });

  it("documents manual repayment, configured pricing, and recovery without auto-yield claims", () => {
    const english = readFileSync(path.join(appRoot, "README.md"), "utf8");
    const chinese = readFileSync(path.join(appRoot, "README.zh-CN.md"), "utf8");
    expect(english).toContain("not an auto-repaying or yield-bearing loan");
    expect(english).toContain("operator-configured `neoPrice`");
    expect(english).toContain("withdrawRepayCredit(account)");
    expect(chinese).toContain("不是自动还款或生息贷款");
    expect(chinese).toContain("运营方写入链上的 `neoPrice`");
  });

  it("ships original modern identity assets and records their provenance", () => {
    for (const file of ["logo.webp", "logo.avif", "banner.webp", "banner.avif"]) {
      expect(statSync(path.join(appRoot, "public", file)).size).toBeGreaterThan(5_000);
    }
    const attribution = readFileSync(path.join(appRoot, "ATTRIBUTION.md"), "utf8");
    expect(attribution).toContain("019f4e0b-ec9b-71b1-9cc3-bec1f3137419");
    expect(attribution).toContain("official Neo Press Kit token files");
  });

  it("keeps the live write lane fail-closed and distinguishes pending from success", () => {
    const hook = readFileSync(path.join(appRoot, "src", "composables", "useSelfLoan.ts"), "utf8");
    const entry = readFileSync(path.join(appRoot, "src", "main.tsx"), "utf8");
    const rpc = readFileSync(path.join(appRoot, "src", "self-loan-rpc.ts"), "utf8");
    expect(hook).toContain('marketStatus.set("error")');
    expect(hook).toContain("result = await run((txid) => {");
    expect(hook).toContain("broadcast = persistBroadcast(draft, txid)");
    expect(hook).toContain("const tracked = broadcast ?? persistBroadcast(draft, result.txid)");
    expect(hook).toContain("operationReadbackMatches(tracked)");
    expect(hook).toContain("app.events.waitFor(restored.txid, restored.eventName, 1)");
    expect(hook).toContain('app.chain.arg.integer(shortfall)');
    expect(hook).toContain('waitForEvent: "RepayCreditWithdrawn"');
    expect(hook).not.toMatch(/credit\s*=\s*0n;\s*\}\s*catch/s);
    expect(entry).toContain("attestContract: attestSelfLoanContract");
    expect(rpc).toContain("checksum: 927_006_627");
    expect(rpc).toContain("updateCounter: 0");
    expect(entry).toContain('if (outcome.value === "confirmed") ctx.framework.notify.success(successKey)');
  });

  it("records the live generation separately from the newer local build", () => {
    const status = readFileSync(path.join(appRoot, "PRODUCTION_STATUS.md"), "utf8");
    const testnet = readFileSync(path.join(appRoot, "TESTNET_STATUS.md"), "utf8");
    expect(status).toContain("927006627");
    expect(status).toContain("1749916863");
    expect(status).toContain("No deployment, contract update, signed transaction");
    expect(testnet).toContain("5 GAS / NEO");
    expect(testnet).toContain("2 GAS");
  });
});
