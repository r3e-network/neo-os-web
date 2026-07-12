import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(process.cwd(), "../..");
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), "utf8");

describe("milestone-escrow production boundary", () => {
  it("pins both networks to the repeatedly verified live deployment", () => {
    const manifest = JSON.parse(read("apps/milestone-escrow/neo-manifest.json"));
    const hash = "0x442162de25008ac78d4cce62ed8d8a64401b7ece";
    expect(manifest.contracts).toEqual({
      "neo-n3-mainnet": hash,
      "neo-n3-testnet": hash,
    });
    expect(manifest.deployment["neo-n3-mainnet"].reason).toContain("frontend-blocked");
    expect(manifest.deployment["neo-n3-testnet"].reason).toContain("recovery methods are not deployed");
  });

  it("keeps new deposits fail-closed on the legacy ABI without blocking existing escrow exits", () => {
    const logic = read("apps/milestone-escrow/src/composables/useMilestoneEscrow.ts");
    expect(logic).toContain('app.chain.readRaw("directAssetCreditOf"');
    expect(logic).toContain('setDeployment("legacy", "deploymentLegacy")');
    expect(logic).toMatch(/createEscrow[\s\S]*await requireFundingWriteReady\(\)/);
    expect(logic).toMatch(/approveMilestone[\s\S]*await requireCoreWriteReady\(\)/);
    expect(logic).toMatch(/claimMilestone[\s\S]*await requireCoreWriteReady\(\)/);
    expect(logic).toMatch(/cancelEscrow[\s\S]*await requireCoreWriteReady\(\)/);
  });

  it("contains the recovery-capable local target without calling it live prematurely", () => {
    const localAbi = JSON.parse(read("contracts/build/MiniAppMilestoneEscrow.manifest.json"));
    const methods = new Set(localAbi.abi.methods.map((method: { name: string }) => method.name));
    for (const method of [
      "directAssetCreditOf",
      "reclaimDirectAssetCredit",
      "reclaimApprovedMilestone",
    ]) expect(methods.has(method)).toBe(true);
    const status = read("apps/milestone-escrow/TESTNET_STATUS.md");
    expect(status).toContain("Missing: `directAssetCreditOf`");
    expect(status).toContain("New escrow creation is disabled before the deposit step");
  });

  it("uses a real escrow asset, official token art, and no browser-native confirmation", () => {
    const playArea = read("apps/milestone-escrow/src/PlayArea.tsx");
    expect(playArea).toContain('src="./milestone-escrow-stage.webp"');
    expect(playArea).toContain("<CoinArt");
    expect(playArea).not.toContain("window.confirm");
    expect(playArea).not.toMatch(/[😀-🙏🌀-🫿]/u);
    expect(fs.statSync(path.join(ROOT, "apps/milestone-escrow/public/milestone-escrow-stage.webp")).size).toBeGreaterThan(50_000);
  });
});
