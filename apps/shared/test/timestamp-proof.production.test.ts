import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const appRoot = process.cwd().endsWith(`${path.sep}apps${path.sep}shared`)
  ? path.resolve(process.cwd(), "../timestamp-proof")
  : path.resolve(process.cwd(), "apps/timestamp-proof");

describe("timestamp-proof production contract", () => {
  it("declares the real local state and optional transaction capabilities", () => {
    const manifest = JSON.parse(readFileSync(path.join(appRoot, "neo-manifest.json"), "utf8"));

    expect(manifest.supported_networks).toEqual(["neo-n3-mainnet", "neo-n3-testnet"]);
    expect(manifest.features.stateless).toBe(false);
    expect(manifest.platform.transactions).toBe(true);
    expect(manifest.permissions).toContain("invoke:primary");
    expect(manifest.permissions).toContain("invoke:platform-social");
    expect(manifest.permissions).toContain("read:blockchain");
    expect(manifest).not.toHaveProperty("stateSource");
    expect(manifest.urls.banner).toBe("/miniapps/timestamp-proof/proof-desk.webp");
  });

  it("keeps broadcast, pending recovery, and verification source as distinct UI state", () => {
    const logic = readFileSync(path.join(appRoot, "src/composables/useTimestampProof.ts"), "utf8");
    const main = readFileSync(path.join(appRoot, "src/main.tsx"), "utf8");

    expect(logic).toContain("waitForEvent: \"Transfer\"");
    expect(logic).toContain("onTransactionSent: rememberBroadcast");
    expect(logic).toContain("anchorStatus: \"pending\"");
    expect(logic).toContain("receipt.status === \"confirmed\"");
    expect(logic).toContain("anchorStatus: \"anchored\"");
    expect(logic).toContain("journalSignature(roundTrip) !== journalSignature(next)");
    // Re-pinned (read-cell pilot): the journal's "checking" first paint used to
    // be a hand-rolled observable initialised to "checking"; it is now the
    // platform read-cell's "not read yet" (value === undefined) DERIVED back to
    // "checking". The intent is unchanged and still pinned: before the first
    // read settles, the storage verdict must be "checking" — never a settled
    // answer a storage fault could masquerade as.
    expect(logic).toContain("createReadCell");
    expect(logic).toContain('journal.value.get()?.state ?? "checking"');
    expect(logic).toContain('anchorStatus: "preparing"');
    expect(logic).toContain("anchorReceiptNotSaved");
    expect(main).toContain("verificationSource: proofContract.verificationSource");
    expect(main).toContain("recoverPendingAnchors");
  });

  it("documents network, production, and asset provenance boundaries", () => {
    for (const file of ["PRODUCTION_STATUS.md", "NETWORK_STATUS.md", "ASSET_PROVENANCE.md"]) {
      expect(readFileSync(path.join(appRoot, file), "utf8").length).toBeGreaterThan(500);
    }
    expect(readFileSync(path.join(appRoot, "ASSET_PROVENANCE.md"), "utf8"))
      .toContain("34db486cca9790ff11e2e958065e1f928f96134b20f1c21fac718cba6a662f92");
  });
});
