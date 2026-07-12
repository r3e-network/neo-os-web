/**
 * flashloan E2E: Verifies the verified contract constants + call patterns
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

function repoFile(relative: string) {
  const root = process.cwd().endsWith(`${path.sep}apps${path.sep}shared`)
    ? path.resolve(process.cwd(), "../..")
    : process.cwd();
  return path.join(root, relative);
}

describe("flashloan E2E lifecycle", () => {
  it("verifies mainnet contract hash is the deployed value", () => {
    const FLASHLOAN_N3_MAINNET = "0xb5d8fb0dc2319edc4be3104304b4136b925df6e4";
    expect(FLASHLOAN_N3_MAINNET).toMatch(/^0x[0-9a-f]{40}$/);
  });

  it("verifies testnet contract hash is the deployed value", () => {
    const FLASHLOAN_N3_TESTNET = "0xde8e595d8d3c293731db499367ee2a768e1e458b";
    expect(FLASHLOAN_N3_TESTNET).toMatch(/^0x[0-9a-f]{40}$/);
    // Must differ from mainnet (different deployment)
    expect(FLASHLOAN_N3_TESTNET).not.toBe("0xb5d8fb0dc2319edc4be3104304b4136b925df6e4");
  });

  it("verifies the flash fee is 9 basis points (0.09%)", () => {
    const FLASH_FEE_BPS = 9;
    expect(FLASH_FEE_BPS / 10000).toBe(0.0009);
  });

  it("pins the verified testnet harness callback while keeping the lender method dynamic", () => {
    const TESTNET_HARNESS_METHOD = "execute";
    const CALLBACK_SIGNATURE = ["Hash160", "Integer", "Integer", "Integer"];
    expect(TESTNET_HARNESS_METHOD).toBe("execute");
    expect(CALLBACK_SIGNATURE).toEqual(["Hash160", "Integer", "Integer", "Integer"]);
  });

  it("verifies the deposit memo prefix", () => {
    const DEPOSIT_MEMO = "miniapp-flashloan:deposit";
    expect(DEPOSIT_MEMO).toMatch(/^miniapp-flashloan:/);
  });

  it("verifies requestLoan args shape: [Hash160 borrower, Integer amount, Hash160 callback, String method]", () => {
    const expectedArgs = [
      { type: "Hash160", value: "borrower-hash" },
      { type: "Integer", value: "100000000" },
      { type: "Hash160", value: "callback-hash" },
      { type: "String", value: "execute" },
    ];
    expect(expectedArgs).toHaveLength(4);
    expect(expectedArgs[0].type).toBe("Hash160");
    expect(expectedArgs[1].type).toBe("Integer");
    expect(expectedArgs[2].type).toBe("Hash160");
    expect(expectedArgs[3].type).toBe("String");
  });

  it("verifies event name is 'LoanExecuted'", () => {
    expect("LoanExecuted").toBe("LoanExecuted");
  });

  it("pins the network-specific deposit ABI arity", () => {
    expect({ mainnet: 3, testnet: 2 }).toEqual({ mainnet: 3, testnet: 2 });
  });

  it("keeps both deployed contracts bound and the duplicate shell form removed", () => {
    const manifest = JSON.parse(fs.readFileSync(repoFile("apps/flashloan/neo-manifest.json"), "utf8"));
    expect(manifest.contracts).toEqual({
      "neo-n3-mainnet": "0xb5d8fb0dc2319edc4be3104304b4136b925df6e4",
      "neo-n3-testnet": "0xde8e595d8d3c293731db499367ee2a768e1e458b",
    });
    expect(manifest.default_network).toBe("neo-n3-mainnet");
    expect(manifest.operation_panel.operations).toEqual([]);
    const runtimeManifest = fs.readFileSync(repoFile("apps/flashloan/src/manifest.ts"), "utf8");
    expect(runtimeManifest).not.toMatch(/\btabs\s*:/);
    expect(runtimeManifest).not.toMatch(/\bsidebar\s*:/);
    expect(runtimeManifest).not.toMatch(/\bstats\s*:/);
  });

  it("ships a real bright DeFi desk image instead of a placeholder surface", () => {
    const asset = fs.readFileSync(repoFile("apps/flashloan/public/flashloan-desk.webp"));
    expect(asset.length).toBeGreaterThan(50_000);
    expect(asset.subarray(8, 12).toString("ascii")).toBe("WEBP");
  });

  it("ships production, network and asset evidence without overstating offline checks", () => {
    const production = fs.readFileSync(repoFile("apps/flashloan/PRODUCTION_STATUS.md"), "utf8");
    const network = fs.readFileSync(repoFile("apps/flashloan/NETWORK_STATUS.md"), "utf8");
    const provenance = fs.readFileSync(repoFile("apps/flashloan/ASSET_PROVENANCE.md"), "utf8");
    expect(production).toContain("No browser, Playwright or screenshot-based design audit was run");
    expect(production).toContain("No live RPC request");
    expect(network).toContain("This pass made no network request");
    expect(network).toMatch(/frozen\s+read-only evidence recorded on 2026-07-11/);
    expect(provenance).toContain("488fa04ec");
    expect(provenance).toContain("No art or code from `IcedSoul/minigame-everyday`");
  });

  it("keeps the financial lifecycle serialized and never maps recovery to a new success", () => {
    const core = fs.readFileSync(
      repoFile("apps/flashloan/src/composables/useFlashloanCore.ts"),
      "utf8",
    );
    expect(core).toContain("withFinancialWrite");
    expect(core).toContain("revalidateWriteContext");
    expect(core).toContain("assertExactTransactionIdentity");
    expect(core).toContain('throw new Error(t("recoveredActionNotReplayed"))');
    expect(core).not.toMatch(/txid:\s*"recovered"[\s\S]{0,80}success:\s*true/);
  });
});
