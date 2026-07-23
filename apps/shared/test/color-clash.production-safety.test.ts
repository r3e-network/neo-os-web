import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { manifest } from "../../color-clash/src/manifest";

const repoRoot = resolve(import.meta.dirname, "../../..");
const read = (path: string): string => readFileSync(resolve(repoRoot, path), "utf8");
const COLOR_CLASH_TESTNET_CHECKSUM = 2_935_733_434;
const COLOR_CLASH_TESTNET_ORACLE = "0x4b882e94ed766807c4fd728768f972e13008ad52";
const PLATFORM_REGISTRY_TESTNET = "0x5ec036efaa1fbde3ff7d1587d790768bc098cb2b";
const PLATFORM_GAME_TESTNET = "0xc75b181b4561462903bb27d8d9e0b32b637bec12";

describe("color-clash production safety", () => {
  it("keeps the complete local arcade open while every paid surface is closed", () => {
    const neo = JSON.parse(read("apps/color-clash/neo-manifest.json")) as {
      contracts?: Record<string, string>;
      moduleId?: string;
      mode?: string;
      registry?: string;
      engine?: string;
      operation_panel: { operations: unknown[] };
      permissions: unknown[];
      platform: { transactions: boolean };
      technologies: { oracle: { enabled: boolean }; tee: { enabled: boolean } };
    };

    const main = read("apps/color-clash/src/main.tsx");
    expect(main).toContain("export const NEW_PAID_RUNS_ENABLED = false");
    expect(manifest.directPlay).toBe(true);
    expect(manifest.supportsGuest).toBe(true);
    expect(manifest.supportsGameFi).toBe(false);
    expect(manifest.gamePage?.modes).toEqual({ guest: true, gamefi: false });
    expect(manifest.operations).toEqual([]);
    expect(manifest.permissions).toEqual({
      payments: false,
      randomness: false,
      compute: false,
      confidential: false,
      oracle: false,
    });
    expect(neo.contracts).toBeUndefined();
    expect(neo.moduleId).toBe("platform-game");
    expect(neo.mode).toBe("shared");
    expect(neo.registry).toBe(PLATFORM_REGISTRY_TESTNET);
    expect(neo.engine).toBe(PLATFORM_GAME_TESTNET);
    expect(neo.operation_panel.operations).toEqual([]);
    expect(neo.permissions).toEqual([]);
    expect(neo.platform.transactions).toBe(false);
    expect(neo.technologies.oracle.enabled).toBe(false);
    expect(neo.technologies.tee.enabled).toBe(false);
  });

  it("pins the reviewed local artifact and exact GameFi ABI", () => {
    const nef = readFileSync(resolve(repoRoot, "contracts/build/MiniAppColorClash.nef"));
    expect(nef.readUInt32LE(nef.length - 4)).toBe(COLOR_CLASH_TESTNET_CHECKSUM);
    expect(COLOR_CLASH_TESTNET_CHECKSUM).toBe(2_935_733_434);
    expect(COLOR_CLASH_TESTNET_ORACLE).toBe(
      "0x4b882e94ed766807c4fd728768f972e13008ad52",
    );

    const abi = JSON.parse(read("contracts/build/MiniAppColorClash.manifest.json")) as {
      name: string;
      extra?: { Version?: string };
      abi: {
        methods: Array<{
          name: string;
          safe: boolean;
          returntype: string;
          parameters: Array<{ type: string }>;
        }>;
        events: Array<{ name: string; parameters: Array<{ type: string }> }>;
      };
    };
    const method = (name: string) => abi.abi.methods.find((entry) => entry.name === name);
    const event = (name: string) => abi.abi.events.find((entry) => entry.name === name);

    expect(abi.name).toBe("MiniAppColorClash");
    expect(abi.extra?.Version).toBe("3.0.0");
    expect(method("startGame")?.parameters.map((entry) => entry.type)).toEqual([
      "Hash160", "Integer",
    ]);
    expect(method("finalizeGame")?.parameters.map((entry) => entry.type)).toEqual([
      "Integer", "String",
    ]);
    expect(method("expireGame")?.parameters.map((entry) => entry.type)).toEqual(["Integer"]);
    expect(method("withdraw")?.parameters.map((entry) => entry.type)).toEqual(["Hash160"]);
    expect(method("getGame")?.safe).toBe(true);
    expect(method("getConfig")?.safe).toBe(true);
    expect(method("oracle")?.safe).toBe(true);
    expect(event("GameStarted")?.parameters).toHaveLength(5);
    expect(event("Solved")?.parameters).toHaveLength(7);
    expect(event("GameExpired")?.parameters).toHaveLength(3);
    expect(event("CreditWithdrawn")?.parameters).toHaveLength(2);
  });

  it("requires contract, config, session, event, readback, and recovery proof", () => {
    const main = read("apps/color-clash/src/main.tsx");

    expect(main).toContain("contractBindingIsExact");
    expect(main).toContain("configMatchesReviewedRules");
    expect(main).toContain("sessionMatchesRule");
    expect(main).toContain("verifyPlayingSession");
    expect(main).toContain("startResultMatchesIntent");
    expect(main).toContain("confirmFinalizedSnapshot");
    expect(main).toContain("eventStateValue(event, 0)");
    expect(main).toContain("rewardGame.snapshot(gameId)");
    expect(main).toContain("gameMatchesIdentity(snapshot.raw");
    expect(main).toContain("before.creditFixed8");
    expect(main).toContain("after.creditFixed8 !== 0n");
    expect(main).toContain("rewardGame.storage.save(gameId, persistedOps)");
    expect(main).toContain('obs.gameStatus.set("unknown")');
    expect(main).toContain("durableOpsStorageAvailable");
  });

  it("uses authored, attributed game resources and direct keyboard play", () => {
    const attribution = read("apps/color-clash/public/art/ATTRIBUTION.md");
    const scene = read("apps/color-clash/src/scenes/ColorClashScene.ts");
    for (const file of [
      "memory-console.webp",
      "arcade-table.webp",
      "pad-red.webp",
      "pad-blue.webp",
      "pad-green.webp",
      "pad-yellow.webp",
      "badge-easy.webp",
      "badge-medium.webp",
      "badge-hard.webp",
    ]) {
      const bytes = readFileSync(resolve(repoRoot, "apps/color-clash/public/art", file));
      expect(bytes.subarray(0, 4).toString("ascii"), file).toBe("RIFF");
      expect(attribution, file).toContain(file);
    }
    expect(scene).toContain('this.input.keyboard?.on("keydown"');
    expect(scene).toContain("Digit1: 0");
    expect(scene).toContain("Numpad4: 3");
    expect(scene).toContain('this.cameras.main.shake(170, 0.006)');
    expect(scene).toContain("playRoundAdvanceFeedback");
    expect(scene).toContain("if (this.reducedMotion) return");
  });
});
