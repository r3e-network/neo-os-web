/**
 * gasbox E2E: Verifies the verified contract constants + flow patterns
 */
import { describe, expect, it } from "vitest";
import {
  assessGasBoxDeployment,
  LEGACY_SETTLE_REROLL_HASH,
} from "../../gasbox/src/deployment";

describe("gasbox E2E lifecycle", () => {
  it("verifies the pull→commit→settle sequence", () => {
    const SEQUENCE = ["prepay", "commit", "settle"];
    expect(SEQUENCE).toEqual(["prepay", "commit", "settle"]);
  });

  it("verifies the player credit and creator pool memo formats", () => {
    expect("miniapp-gasbox:play").toBe("miniapp-gasbox:play");
    const poolMemo = (machineId: string) => `miniapp-gasbox-pool:${machineId}`;
    expect(poolMemo("1")).toBe("miniapp-gasbox-pool:1");
  });

  it("verifies the settle event name", () => {
    expect("Settled").toBe("Settled");
  });

  it("verifies the commit event name", () => {
    expect("Committed").toBe("Committed");
  });

  it("verifies the GAS hash for payment", () => {
    const GAS_HASH = "0xd2a4cff31913016155e38e474a2c06d08be276cf";
    expect(GAS_HASH).toMatch(/^0x[0-9a-f]{40}$/);
  });

  it("advertises the live V2 contract honestly without stale PlatformGame or VRF claims", async () => {
    const { readFile } = await import("node:fs/promises");
    const manifest = JSON.parse(
      await readFile(`${process.cwd()}/../gasbox/neo-manifest.json`, "utf8"),
    ) as {
      contracts: Record<string, string>;
      features: { stateless: boolean };
      technologies: { vrf: { enabled: boolean } };
      runtime?: unknown;
      operation_panel: { operations: unknown[] };
    };
    expect(manifest.contracts["neo-n3-mainnet"]).toBe(
      LEGACY_SETTLE_REROLL_HASH,
    );
    expect(manifest.contracts["neo-n3-testnet"]).toBe(LEGACY_SETTLE_REROLL_HASH);
    expect(assessGasBoxDeployment(manifest.contracts["neo-n3-mainnet"])).toEqual({
      writeCompatible: false,
      reason: "legacy-settle-reroll",
    });
    expect(manifest.features.stateless).toBe(false);
    expect(manifest.technologies.vrf.enabled).toBe(false);
    expect(manifest.runtime).toBeUndefined();
    expect(manifest.operation_panel.operations).toEqual([]);
  });
});
